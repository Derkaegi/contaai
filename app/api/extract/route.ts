import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { extractDocument } from '@/lib/extract'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { storage_path, storage_url, context = 'business' } = body

  if (!storage_path) {
    return NextResponse.json({ error: 'storage_path required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: fileData, error: fetchError } = await db.storage
    .from('invoices')
    .download(storage_path)

  if (fetchError || !fileData) {
    return NextResponse.json({ error: fetchError?.message ?? 'File not found' }, { status: 404 })
  }

  const filename = storage_path.split('/').pop() ?? 'document.pdf'
  const arrayBuffer = await fileData.arrayBuffer()
  const extraction = await extractDocument(arrayBuffer, filename)

  if ('error' in extraction) {
    return NextResponse.json({ error: extraction.error, notizen: extraction.notizen }, { status: 422 })
  }

  const { datum, typ, vendor, betrag, quartal, year, filename: newFilename } = extraction

  const newPath = datum
    ? `${year}/${quartal}/${newFilename}`
    : `unsorted/${newFilename}`

  if (datum) {
    await db.storage.from('invoices').move(storage_path, newPath)
  }

  const finalUrl = datum
    ? db.storage.from('invoices').getPublicUrl(newPath).data.publicUrl
    : storage_url

  const { data: doc, error: insertError } = await db
    .from('documents')
    .insert({
      context,
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

  return NextResponse.json(doc)
}
