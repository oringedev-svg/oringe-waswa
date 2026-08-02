import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, getSessionProfile } from '@/lib/auth'

// Send assignment/work to client via email
// Only the assigner (person who created the assignment) can send
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const supabase = createAdminClient()

  // Fetch assignment
  const { data: assignment, error: fetchError } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchError || !assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  // Only assigner can send to client
  if (assignment.assigned_by !== profile.id) {
    return NextResponse.json(
      { error: 'Only the assigner can send work to client' },
      { status: 403 }
    )
  }

  // Must be approved to send
  if (assignment.status !== 'Approved') {
    return NextResponse.json(
      { error: 'Assignment must be approved before sending to client' },
      { status: 400 }
    )
  }

  // Fetch matter and matter_people to get client contact
  const { data: matter } = await supabase
    .from('legal_matters')
    .select('id, matter_number, title, client_email:matter_people!inner(profile:profiles(email, full_name))')
    .eq('id', assignment.matter_id)
    .single()

  if (!matter) {
    return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
  }

  // Get client email from matter_people
  const clientEmail = (matter as any)?.client_email?.[0]?.profile?.email
  if (!clientEmail) {
    return NextResponse.json(
      { error: 'No client email found for this matter' },
      { status: 400 }
    )
  }

  // Fetch documents linked to this assignment (legal_documents, the same
  // table Matter Documents reads, not the separate `documents` table)
  const { data: docs } = await supabase
    .from('legal_documents')
    .select('id, file_name, file_url')
    .eq('assignment_id', params.id)

  // Send email (placeholder - integrate with email service)
  // For now, log the intention
  const emailSent = await sendClientEmail({
    clientEmail,
    matterNumber: matter.matter_number,
    matterTitle: matter.title,
    assignmentId: params.id,
    documents: docs || [],
  })

  if (!emailSent) {
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }

  // Update assignment with sent timestamp and create message
  const { data: updated, error: updateError } = await supabase
    .from('assignments')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Create system message
  await supabase
    .from('assignment_messages')
    .insert({
      assignment_id: params.id,
      sender_id: profile.id,
      message_type: 'System',
      content: `Work sent to client (${clientEmail})`,
    })

  return NextResponse.json({
    success: true,
    message: `Work sent to ${clientEmail}`,
    assignment: updated,
  })
}

async function sendClientEmail({
  clientEmail,
  matterNumber,
  matterTitle,
  assignmentId,
  documents,
}: {
  clientEmail: string
  matterNumber: string
  matterTitle: string
  assignmentId: string
  documents: Array<{ id: string; file_name: string; file_url: string }>
}) {
  try {
    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    // For now, just log
    console.log(`[EMAIL] Sending to ${clientEmail}`, {
      subject: `Work Completed: ${matterNumber} - ${matterTitle}`,
      to: clientEmail,
      attachments: documents.length,
      portal_link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'}/portal/matters/${matterNumber}`,
    })

    // Simulate email send success
    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

// Email template function (would be called by sendClientEmail).
// Deliberately NOT exported: an App Router route module may only export
// route handlers and the framework's config keys, and exporting this broke
// `next build` with a checkFields type error. Nothing outside this file
// uses it, so keeping it module-local is the whole fix.
function getClientEmailTemplate({
  clientName,
  matterNumber,
  matterTitle,
  workSummary,
  portalLink,
}: {
  clientName: string
  matterNumber: string
  matterTitle: string
  workSummary: string
  portalLink: string
}) {
  return {
    subject: `Work Completed: ${matterNumber} - ${matterTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b6e8f 0%, #2d5170 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: 600; color: #1f2937; margin-bottom: 10px; }
    .matter-details { background: white; padding: 15px; border-left: 4px solid #3b6e8f; margin: 15px 0; border-radius: 4px; }
    .button { display: inline-block; background: #3b6e8f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: 500; }
    .button:hover { background: #2d5170; }
    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666; margin-top: 20px; }
    .firm-name { font-weight: 600; color: #3b6e8f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Work Completed</h1>
      <p>Oringe Waswa & Akude Advocates LLP</p>
    </div>

    <div class="content">
      <p>Dear ${clientName},</p>

      <p>We are pleased to inform you that work on your matter has been completed and is ready for your review.</p>

      <div class="matter-details">
        <div class="section-title">Matter Details</div>
        <p><strong>Matter Number:</strong> ${matterNumber}</p>
        <p><strong>Matter Title:</strong> ${matterTitle}</p>
      </div>

      <div class="section">
        <div class="section-title">What's Included</div>
        <p>${workSummary}</p>
      </div>

      <div class="section">
        <div class="section-title">Review Your Work</div>
        <p>You can view and download the completed work through your client portal:</p>
        <a href="${portalLink}" class="button">View in Client Portal</a>
      </div>

      <div class="section">
        <div class="section-title">Next Steps</div>
        <p>If you have any questions or require clarification on the work completed, please don't hesitate to contact us. We're here to help.</p>
      </div>

      <div class="footer">
        <p>
          <span class="firm-name">Oringe Waswa & Akude Advocates LLP</span><br>
          <a href="https://oringewaswa.co.ke" style="color: #3b6e8f; text-decoration: none;">www.oringewaswa.co.ke</a>
        </p>
        <p>This email and any attachments are confidential and intended solely for the use of the recipient.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `,
    text: `
WORK COMPLETED
Oringe Waswa & Akude Advocates LLP

Dear ${clientName},

We are pleased to inform you that work on your matter has been completed and is ready for your review.

MATTER DETAILS
Matter Number: ${matterNumber}
Matter Title: ${matterTitle}

WHAT'S INCLUDED
${workSummary}

REVIEW YOUR WORK
You can view and download the completed work through your client portal:
${portalLink}

NEXT STEPS
If you have any questions or require clarification on the work completed, please don't hesitate to contact us.

---
Oringe Waswa & Akude Advocates LLP
www.oringewaswa.co.ke

This email and any attachments are confidential and intended solely for the use of the recipient.
    `,
  }
}
