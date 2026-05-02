import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { isGwsAvailable } from '@/lib/provider'

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
    const output = execSync(
      `${GWS} drive files list --format json --params '{"q":"\\"${DRIVE_INBOX_ID}\\" in parents and trashed=false and mimeType=\\"application/pdf\\"","fields":"files(id,name,mimeType,size,modifiedTime,parents)","orderBy":"modifiedTime desc"}'`,
      { encoding: 'utf8', timeout: 15000 }
    )
    const data = JSON.parse(output)
    const files = (data.files ?? []).map((f: Record<string, string>) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: parseInt(f.size ?? '0', 10),
      modifiedTime: f.modifiedTime,
    }))
    return NextResponse.json({ files, folderId: DRIVE_INBOX_ID })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
