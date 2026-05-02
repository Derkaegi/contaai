import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const MAX_SIZE_MB = 20
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not supported. Use PDF or image.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File too large. Max ${MAX_SIZE_MB}MB.` }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const uuid = crypto.randomUUID()
  const storagePath = `inbox/${uuid}.${ext}`

  const db = createServiceClient()
  const arrayBuffer = await file.arrayBuffer()

  const { error } = await db.storage
    .from('invoices')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: urlData } = db.storage.from('invoices').getPublicUrl(storagePath)

  return NextResponse.json({
    storage_path: storagePath,
    storage_url: urlData.publicUrl,
    original_name: file.name,
    file_type: file.type,
  })
}
