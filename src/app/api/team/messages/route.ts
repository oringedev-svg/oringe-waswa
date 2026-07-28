import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const recipient_id = searchParams.get('recipient_id')
  const sender_id = searchParams.get('sender_id')

  let query = supabase
    .from('team_messages')
    .select('*, sender:team_members!team_messages_sender_id_fkey(full_name, avatar_url, position)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (recipient_id) query = query.or(`recipient_id.eq.${recipient_id},is_broadcast.eq.true`)
  if (sender_id) query = query.eq('sender_id', sender_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase.from('team_messages').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
