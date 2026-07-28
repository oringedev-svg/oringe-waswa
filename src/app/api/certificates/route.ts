import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { generateCertificateContent } from '@/lib/openai'
import { format } from 'date-fns'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const recipient_id = searchParams.get('recipient_id')

  let query = supabase
    .from('certificates')
    .select('*, recipient:profiles(full_name, email)')
    .order('created_at', { ascending: false })

  if (recipient_id) query = query.eq('recipient_id', recipient_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { recipient_id, type, title, description, issued_by, send_email: doSendEmail } = body

  // Get recipient
  const { data: recipient } = await supabase.from('profiles').select('*').eq('id', recipient_id).single()
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

  const issued_date = format(new Date(), 'MMMM d, yyyy')

  // AI generate certificate content
  let aiContent = ''
  try {
    aiContent = await generateCertificateContent({
      recipientName: recipient.full_name,
      type,
      achievement: description || title,
      date: issued_date,
      firmName: 'Oringe Waswa & Akude Advocates LLP',
    })
  } catch {}

  const { data: cert, error } = await supabase
    .from('certificates')
    .insert({
      recipient_id,
      type,
      title,
      description: aiContent || description,
      issued_date: new Date().toISOString().split('T')[0],
      issued_by,
      template_data: { recipientName: recipient.full_name, aiContent, type, title },
      is_sent: false,
    })
    .select('*, recipient:profiles(full_name, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send via email if requested
  if (doSendEmail && recipient.email) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: `Your Certificate, ${title}`,
        html: `
          <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px;border:2px solid #c8952a;text-align:center;">
            <h1 style="color:#8b6914;font-size:32px;">Certificate of ${type.replace(/_/g,' ').replace(/\b\w/g,(l: string)=>l.toUpperCase())}</h1>
            <p style="font-size:18px;margin:20px 0;">This is to certify that</p>
            <h2 style="color:#1a1610;font-size:28px;border-bottom:2px solid #c8952a;padding-bottom:12px;">${recipient.full_name}</h2>
            <p style="font-size:16px;line-height:1.8;margin:24px 0;">${aiContent || description}</p>
            <p style="margin-top:32px;color:#7a6f5e;">Issued on ${issued_date}</p>
            <p style="color:#c8952a;font-weight:bold;">Oringe Waswa & Akude Advocates LLP</p>
          </div>`,
      })
      await supabase.from('certificates').update({ is_sent: true }).eq('id', cert.id)
    } catch (e) { console.warn('Certificate email failed:', e) }
  }

  return NextResponse.json(cert, { status: 201 })
}
