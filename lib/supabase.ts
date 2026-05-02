import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)

export function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? supabaseUrl,
    process.env.SUPABASE_SERVICE_KEY!
  )
}
