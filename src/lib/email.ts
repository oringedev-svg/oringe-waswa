import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
})

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[]
}

export async function sendEmail(opts: EmailOptions) {
  const info = await transporter.sendMail({
    from: `"Oringe Waswa & Akude Advocates LLP" <${process.env.EMAIL_USER}>`,
    to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments,
  })
  return info
}

// ---- Email Templates ----

export function submissionConfirmationEmail(data: {
  name: string
  type: string
  trackingCode: string
  appUrl: string
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'DM Sans', Arial, sans-serif; color: #1a1610; background: #fdfaf5; margin:0; padding:0; }
  .wrapper { max-width: 600px; margin: 0 auto; }
  .header { background: #1a1610; padding: 32px 40px; }
  .header h1 { color: #c8952a; font-size: 24px; margin:0; font-family: Georgia, serif; }
  .body { padding: 40px; background: #fdfaf5; }
  .tracking { background: #f5f0e8; border: 1px solid #e2d8c4; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center; }
  .tracking-code { font-size: 28px; font-weight: 700; color: #c8952a; letter-spacing: 4px; font-family: monospace; }
  .btn { display: inline-block; padding: 12px 32px; background: #c8952a; color: #fff; text-decoration: none; border-radius: 4px; font-weight: 600; margin-top: 16px; }
  .footer { padding: 24px 40px; background: #1a1610; color: #8a7d6a; font-size: 12px; text-align: center; }
</style></head>
<body><div class="wrapper">
  <div class="header"><h1>Oringe Waswa & Akude Advocates LLP</h1></div>
  <div class="body">
    <p>Dear ${data.name},</p>
    <p>Thank you for your <strong>${data.type}</strong> submission to Oringe Waswa & Akude Advocates LLP. We have received your request and will process it shortly.</p>
    <div class="tracking">
      <p style="margin:0 0 8px; color:#4a4035; font-size:14px; text-transform:uppercase; letter-spacing:2px;">Your Tracking Code</p>
      <div class="tracking-code">${data.trackingCode}</div>
    </div>
    <p>You can use this code to track the status of your submission at any time.</p>
    <a href="${data.appUrl}/track?code=${data.trackingCode}" class="btn">Track Your Submission</a>
    <p style="margin-top:32px; color:#7a6f5e; font-size:14px;">If you have any questions, please contact us at <a href="mailto:${process.env.EMAIL_USER}" style="color:#c8952a;">${process.env.EMAIL_USER}</a>.</p>
  </div>
  <div class="footer">© ${new Date().getFullYear()} Oringe Waswa & Akude Advocates LLP. All rights reserved.</div>
</div></body></html>`
}

export function statusUpdateEmail(data: {
  name: string
  type: string
  trackingCode: string
  status: string
  message: string
  appUrl: string
}) {
  const statusColors: Record<string, string> = {
    pending: '#c8952a', under_review: '#1a4d6e', accepted: '#2d6a4f',
    rejected: '#9b2335', completed: '#2d6a4f', interview_scheduled: '#6b3d99',
  }
  const color = statusColors[data.status] || '#c8952a'
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #1a1610; background: #fdfaf5; }
  .wrapper { max-width: 600px; margin: 0 auto; }
  .header { background: #1a1610; padding: 32px 40px; }
  .header h1 { color: #c8952a; font-size: 24px; margin:0; font-family: Georgia, serif; }
  .body { padding: 40px; }
  .status-badge { display: inline-block; padding: 6px 16px; border-radius: 100px; background: ${color}22; color: ${color}; border: 1px solid ${color}55; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
  .message-box { background: #f5f0e8; border-left: 4px solid ${color}; border-radius: 0 8px 8px 0; padding: 20px; margin: 24px 0; }
  .btn { display: inline-block; padding: 12px 32px; background: #c8952a; color: #fff; text-decoration: none; border-radius: 4px; font-weight: 600; margin-top: 16px; }
  .footer { padding: 24px 40px; background: #1a1610; color: #8a7d6a; font-size: 12px; text-align: center; }
</style></head>
<body><div class="wrapper">
  <div class="header"><h1>Oringe Waswa & Akude Advocates LLP</h1></div>
  <div class="body">
    <p>Dear ${data.name},</p>
    <p>There is an update on your <strong>${data.type}</strong> submission (${data.trackingCode}).</p>
    <p>Status: <span class="status-badge">${data.status.replace(/_/g, ' ')}</span></p>
    <div class="message-box"><p style="margin:0; color:#4a4035;">${data.message}</p></div>
    <a href="${data.appUrl}/track?code=${data.trackingCode}" class="btn">View Full Update</a>
  </div>
  <div class="footer">© ${new Date().getFullYear()} Oringe Waswa & Akude Advocates LLP. All rights reserved.</div>
</div></body></html>`
}

export function appointmentConfirmationEmail(data: {
  clientName: string
  date: string
  time: string
  attorney: string
  location?: string
  meetingLink?: string
  appUrl: string
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #1a1610; background: #fdfaf5; }
  .wrapper { max-width: 600px; margin: 0 auto; }
  .header { background: #1a1610; padding: 32px 40px; }
  .header h1 { color: #c8952a; font-size: 24px; margin:0; font-family: Georgia, serif; }
  .body { padding: 40px; }
  .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #e2d8c4; }
  .detail-label { width: 140px; color: #7a6f5e; font-size:14px; font-weight:600; text-transform:uppercase; letter-spacing:1px; }
  .detail-value { flex:1; color: #1a1610; }
  .footer { padding: 24px 40px; background: #1a1610; color: #8a7d6a; font-size: 12px; text-align: center; }
</style></head>
<body><div class="wrapper">
  <div class="header"><h1>Appointment Confirmed</h1></div>
  <div class="body">
    <p>Dear ${data.clientName},</p>
    <p>Your appointment has been confirmed. Here are the details:</p>
    <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${data.date}</span></div>
    <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${data.time}</span></div>
    <div class="detail-row"><span class="detail-label">Attorney</span><span class="detail-value">${data.attorney}</span></div>
    ${data.location ? `<div class="detail-row"><span class="detail-label">Location</span><span class="detail-value">${data.location}</span></div>` : ''}
    ${data.meetingLink ? `<div class="detail-row"><span class="detail-label">Meeting Link</span><span class="detail-value"><a href="${data.meetingLink}" style="color:#c8952a;">${data.meetingLink}</a></span></div>` : ''}
    <p style="margin-top:24px; color:#7a6f5e; font-size:14px;">Please arrive 10 minutes early. To reschedule, contact us at least 24 hours in advance.</p>
  </div>
  <div class="footer">© ${new Date().getFullYear()} Oringe Waswa & Akude Advocates LLP.</div>
</div></body></html>`
}

export function mailingListWelcomeEmail(name: string, unsubscribeUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#1a1610;background:#fdfaf5;">
  <div style="max-width:600px;margin:0 auto;">
    <div style="background:#1a1610;padding:32px 40px;">
      <h1 style="color:#c8952a;font-size:24px;margin:0;font-family:Georgia,serif;">Oringe Waswa & Akude Advocates LLP</h1>
    </div>
    <div style="padding:40px;">
      <h2>Welcome, ${name}!</h2>
      <p>Thank you for subscribing to our newsletter. You'll receive updates on legal insights, firm news, and important announcements.</p>
      <p style="margin-top:32px;font-size:12px;color:#7a6f5e;">
        <a href="${unsubscribeUrl}" style="color:#c8952a;">Unsubscribe</a> | 
        You're receiving this because you subscribed at ${process.env.NEXT_PUBLIC_APP_URL}
      </p>
    </div>
  </div>
</body></html>`
}
