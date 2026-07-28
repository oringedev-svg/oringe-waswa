import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('mail_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase.from('mail_campaigns').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest) {
  // Send campaign
  const supabase = createAdminClient()
  const { id } = await req.json()

  const { data: campaign, error } = await supabase.from('mail_campaigns').select('*').eq('id', id).single()
  if (error || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Get subscribers
  let subsQuery = supabase.from('mail_subscribers').select('email, name').eq('is_active', true)
  if (campaign.recipient_tags?.length) {
    subsQuery = subsQuery.overlaps('tags', campaign.recipient_tags)
  }
  const { data: subscribers } = await subsQuery

  let sent = 0
  for (const sub of subscribers || []) {
    try {
      const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?email=${encodeURIComponent(sub.email)}`
      await sendEmail({
        to: sub.email,
        subject: campaign.subject,
        html: campaign.content + `<br><br><hr><p style="font-size:11px;color:#888;">
          <a href="${unsubUrl}">Unsubscribe</a> | Oringe Waswa & Akude Advocates LLP
        </p>`,
      })
      sent++
    } catch {}
  }

  await supabase.from('mail_campaigns').update({
    status: 'sent',
    sent_count: sent,
    sent_at: new Date().toISOString(),
  }).eq('id', id)

  return NextResponse.json({ sent })
}
