import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail, mailingListWelcomeEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const active_only = searchParams.get('active') !== 'false'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabase
    .from('mail_subscribers')
    .select('*', { count: 'exact' })
    .order('subscribed_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (active_only) query = query.eq('is_active', true)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const { email, name, tags } = await req.json()

  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const { data, error } = await supabase
    .from('mail_subscribers')
    .upsert({ email, name, is_active: true, tags: tags || [] }, { onConflict: 'email' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send welcome email
  try {
    const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?email=${encodeURIComponent(email)}`
    await sendEmail({
      to: email,
      subject: 'Welcome to Oringe Waswa & Akude Advocates LLP Newsletter',
      html: mailingListWelcomeEmail(name || 'Subscriber', unsubUrl),
    })
  } catch (e) { console.warn('Welcome email failed:', e) }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  const id = searchParams.get('id')

  if (email) {
    await supabase.from('mail_subscribers').update({ is_active: false, unsubscribed_at: new Date().toISOString() }).eq('email', email)
  } else if (id) {
    await supabase.from('mail_subscribers').delete().eq('id', id)
  }

  return NextResponse.json({ success: true })
}
