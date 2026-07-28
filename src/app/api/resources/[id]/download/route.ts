import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// Public, anyone downloading a resource increments its counter. No auth
// required since public resources are, by definition, public.
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data: current } = await supabase.from('client_resources').select('download_count').eq('id', params.id).single()
  const { error } = await supabase
    .from('client_resources')
    .update({ download_count: (current?.download_count || 0) + 1 })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
