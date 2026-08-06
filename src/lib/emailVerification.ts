import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

// The generic engine every public, unauthenticated submission form goes
// through: create the record unverified, mail a confirmation link, and only
// mark it verified (and let the caller run whatever should happen next) once
// the person who owns that inbox actually confirms. The record's own
// email_verified_at column is what every admin-facing read filters on, this
// module never needs touching to add a table -- see migration 060.

export type VerifiableTable = 'submissions' | 'appointments' | 'job_applications'

const EXPIRY_HOURS = 48

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export async function createEmailVerification(
  db: ReturnType<typeof createAdminClient>,
  args: { email: string; name: string; targetTable: VerifiableTable; targetId: string; context: string },
): Promise<void> {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 3600 * 1000).toISOString()

  await db.from('email_verifications').insert({
    token,
    email: args.email,
    target_table: args.targetTable,
    target_id: args.targetId,
    expires_at: expiresAt,
  })

  const confirmUrl = `${appUrl()}/verify-email?token=${token}`

  // Best-effort: if mail is down, the row still exists and a resend path
  // (or a staff member reaching out directly) can recover it later. It must
  // never block the public form from returning a response.
  try {
    await sendEmail({
      to: args.email,
      subject: 'Confirm your email — Oringe Waswa & Akude Advocates LLP',
      html: verificationEmailHtml({ name: args.name, confirmUrl, context: args.context }),
    })
  } catch (e) {
    console.error('Verification email failed to send:', e)
  }
}

function verificationEmailHtml({ name, confirmUrl, context }: { name: string; confirmUrl: string; context: string }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #1a1610; background: #fdfaf5; }
  .wrapper { max-width: 600px; margin: 0 auto; }
  .header { background: #1a1610; padding: 32px 40px; }
  .header h1 { color: #c8952a; font-size: 24px; margin:0; font-family: Georgia, serif; }
  .body { padding: 40px; }
  .btn { display: inline-block; padding: 12px 32px; background: #c8952a; color: #fff; text-decoration: none; border-radius: 4px; font-weight: 600; margin-top: 16px; }
  .footer { padding: 24px 40px; background: #1a1610; color: #8a7d6a; font-size: 12px; text-align: center; }
</style></head>
<body><div class="wrapper">
  <div class="header"><h1>Oringe Waswa &amp; Akude Advocates LLP</h1></div>
  <div class="body">
    <p>Dear ${name},</p>
    <p>Thank you for ${context}. Before we can act on it, please confirm this is really your email address.</p>
    <a href="${confirmUrl}" class="btn">Confirm my email</a>
    <p style="margin-top:24px; color:#7a6f5e; font-size:14px;">This link expires in 48 hours. If you didn't request this, you can safely ignore this email — nothing happens until it's confirmed.</p>
  </div>
  <div class="footer">© ${new Date().getFullYear()} Oringe Waswa & Akude Advocates LLP. All rights reserved.</div>
</div></body></html>`
}

export interface ConsumeResult {
  ok: boolean
  error?: 'invalid' | 'expired' | 'already_used'
  targetTable?: VerifiableTable
  targetId?: string
  email?: string
}

const VERIFIABLE_TABLES: VerifiableTable[] = ['submissions', 'appointments', 'job_applications']

/**
 * Consumes a token exactly once: marks it verified, flips the target row's
 * email_verified_at, and hands the caller enough to run whatever deferred
 * side effects (AI analysis, the "you're confirmed" email, etc.) belong to
 * that specific table. Deliberately requires an explicit POST from the
 * caller's side (see /api/verify-email) rather than firing on a bare page
 * load -- corporate email security scanners auto-fetch links in incoming
 * mail to check them for malware, and a GET that consumed the token would
 * burn it before the real person ever clicked.
 */
export async function consumeEmailVerification(token: string): Promise<ConsumeResult> {
  if (!token || typeof token !== 'string') return { ok: false, error: 'invalid' }

  const db = createAdminClient()
  const { data: row } = await db.from('email_verifications').select('*').eq('token', token).maybeSingle()
  if (!row || !VERIFIABLE_TABLES.includes(row.target_table)) return { ok: false, error: 'invalid' }
  if (row.verified_at) return { ok: false, error: 'already_used' }
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: 'expired' }

  await db.from('email_verifications').update({ verified_at: new Date().toISOString() }).eq('id', row.id)
  await db.from(row.target_table).update({ email_verified_at: new Date().toISOString() }).eq('id', row.target_id)

  return { ok: true, targetTable: row.target_table as VerifiableTable, targetId: row.target_id, email: row.email }
}
