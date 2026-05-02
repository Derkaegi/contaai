import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { deriveQuarter, deriveYear } from '@/lib/utils'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  if (body.datum) {
    body.quartal = deriveQuarter(body.datum)
    body.year = deriveYear(body.datum)
  }

  body.updated_at = new Date().toISOString()

  const { data, error } = await db
    .from('documents')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = createServiceClient()

  const { error } = await db.from('documents').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
