import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { isGwsAvailable } from '@/lib/provider'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const GWS = `${process.env.HOME}/.local/bin/gws`
const DRIVE_INBOX_ID = '12JtwV3HNFPOLpJxcCBvlOtVKJIyfnhUe'

export async function GET() {
  if (!isGwsAvailable()) {
    return NextResponse.json(
      { error: 'Google Drive not available in this environment. Run locally to use Drive sync.' },
      { status: 503 }
    )
  }

  try {
    const [driveOutput, dbResult] = await Promise.all([
      Promise.resolve(execSync(
        `${GWS} drive files list --format json --params '{"q":"\\"${DRIVE_INBOX_ID}\\" in parents and trashed=false and mimeType=\\"application/pdf\\"","fields":"files(id,name,mimeType,size,modifiedTime)","orderBy":"modifiedTime desc"}'`,
        { encoding: 'utf8', timeout: 15000 }
      )),
      createServiceClient()
        .from('documents')
        .select('drive_file_id')
        .not('drive_file_id', 'is', null),
    ])

    const data = JSON.parse(driveOutput)
    const files = (data.files ?? []).map((f: Record<string, string>) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: parseInt(f.size ?? '0', 10),
      modifiedTime: f.modifiedTime,
    }))

    const importedIds: string[] = (dbResult.data ?? [])
      .map((r: { drive_file_id: string }) => r.drive_file_id)
      .filter(Boolean)

    return NextResponse.json({ files, folderId: DRIVE_INBOX_ID, importedIds })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
