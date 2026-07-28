import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, service, key_preview, is_active, created_at, last_used')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const { name, service, key } = await req.json()
  if (!name || !service || !key) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  const key_preview = key.slice(0, 8) + '…' + key.slice(-4)
  // In production use proper encryption; here we store as-is for simplicity
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ name, service, encrypted_key: key, key_preview, is_active: true })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient()
  const { id, is_active } = await req.json()
  const { data, error } = await supabase
    .from('api_keys')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const { error } = await supabase.from('api_keys').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
