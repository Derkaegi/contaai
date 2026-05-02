import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createServiceClient } from '@/lib/supabase'
import { extractDocument } from '@/lib/extract'
import { isGwsAvailable } from '@/lib/provider'

export const runtime = 'nodejs'

const GWS = `${process.env.HOME}/.local/bin/gws`

export async function POST(req: NextRequest) {
  if (!isGwsAvailable()) {
    return NextResponse.json(
      { error: 'Google Drive not available in this environment.' },
      { status: 503 }
    )
  }

  const body = await req.json()
  const { fileId, fileName, context = 'business' } = body

  if (!fileId || !fileName) {
    return NextResponse.json({ error: 'fileId and fileName required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Dedup check — return existing document if already imported
  const { data: existing } = await db
    .from('documents')
    .select('*')
    .eq('drive_file_id', fileId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ...existing, skipped: true }, { status: 200 })
  }

  const safeName = fileName.replace(/[^a-z0-9._-]/gi, '_')
  const tmpPath = join(tmpdir(), `drive_${Date.now()}_${safeName}`)

  try {
    execSync(
      `${GWS} drive files get -o "${tmpPath}" --params '{"fileId":"${fileId}","alt":"media"}'`,
      { encoding: 'utf8', timeout: 30000 }
    )
  } catch (err) {
    return NextResponse.json({ error: `Drive download failed: ${(err as Error).message}` }, { status: 500 })
  }

  let fileBuffer: ArrayBuffer
  try {
    fileBuffer = readFileSync(tmpPath).buffer as ArrayBuffer
  } catch (err) {
    return NextResponse.json({ error: `File read failed: ${(err as Error).message}` }, { status: 500 })
  } finally {
    try { unlinkSync(tmpPath) } catch {}
  }

  const storagePath = `inbox/${Date.now()}_${safeName}`
  const { error: uploadError } = await db.storage
    .from('invoices')
    .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = db.storage.from('invoices').getPublicUrl(storagePath)
  const storageUrl = urlData.publicUrl

  const extraction = await extractDocument(fileBuffer, fileName)

  if ('error' in extraction) {
    return NextResponse.json({ error: extraction.error, notizen: extraction.notizen }, { status: 422 })
  }

  const { datum, typ, vendor, quartal, year, filename: newFilename } = extraction
  const newPath = datum ? `${year}/${quartal}/${newFilename}` : `unsorted/${newFilename}`

  if (datum) {
    await db.storage.from('invoices').move(storagePath, newPath)
  }

  const finalUrl = datum
    ? db.storage.from('invoices').getPublicUrl(newPath).data.publicUrl
    : storageUrl

  const { data: doc, error: insertError } = await db
    .from('documents')
    .insert({
      context,
      drive_file_id: fileId,
      datum,
      typ,
      vendor,
      betrag: extraction.betrag,
      mwst: extraction.mwst,
      netto: extraction.netto,
      irpf: extraction.irpf,
      kategorie: extraction.kategorie,
      projekt: extraction.projekt,
      status: extraction.status,
      quartal,
      year,
      filename: newFilename,
      storage_path: newPath,
      storage_url: finalUrl,
      notizen: extraction.notizen,
      extraction_raw: extraction.extraction_raw,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(doc, { status: 201 })
}
