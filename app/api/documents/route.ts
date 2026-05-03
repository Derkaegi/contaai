import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const year = searchParams.get('year')
  const quartal = searchParams.get('quartal')
  const typ = searchParams.get('typ')
  const kategorie = searchParams.get('kategorie')
  const status = searchParams.get('status')
  const context = searchParams.get('context')
  const cuenta = searchParams.get('cuenta')
  const q = searchParams.get('q')
  const limit = parseInt(searchParams.get('limit') ?? '200', 10)

  const db = createServiceClient()
  let query = db
    .from('documents')
    .select('*')
    .order('datum', { ascending: false })
    .limit(limit)

  if (year) query = query.eq('year', parseInt(year, 10))
  if (quartal) query = query.eq('quartal', quartal)
  if (typ) query = query.eq('typ', typ)
  if (kategorie) query = query.eq('kategorie', kategorie)
  if (status) query = query.eq('status', status)
  if (context) query = query.eq('context', context)
  if (cuenta) query = query.eq('cuenta', cuenta)
  if (q) query = query.ilike('vendor', `%${q}%`)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()

  const { data, error } = await db
    .from('documents')
    .insert(body)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
