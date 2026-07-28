// Minimal iCalendar (RFC 5545) invite builder, no external API, no
// dependency, no OAuth. Any attendee can open the attached .ics in
// whatever calendar app they already use (Google, Outlook, Apple) and it
// just works, which is the whole point: the firm doesn't need to integrate
// with any specific calendar provider to send a reliable invite.

export interface IcsAttendee {
  name: string
  email: string
}

export interface IcsEventInput {
  uid: string
  title: string
  description?: string
  location?: string
  startAt: string | Date
  endAt: string | Date
  organizer: IcsAttendee
  attendees: IcsAttendee[]
  method?: 'REQUEST' | 'CANCEL'
}

function toIcsDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

// Folds long lines and escapes reserved characters per RFC 5545 §3.3.11.
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildIcsInvite(event: IcsEventInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Oringe Waswa & Akude Advocates LLP//Calendar//EN',
    `METHOD:${event.method || 'REQUEST'}`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(event.startAt)}`,
    `DTEND:${toIcsDate(event.endAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ]
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`)
  lines.push(`ORGANIZER;CN=${escapeText(event.organizer.name)}:mailto:${event.organizer.email}`)
  for (const a of event.attendees) {
    lines.push(`ATTENDEE;CN=${escapeText(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`)
  }
  lines.push(`STATUS:${event.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`, 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function meetingInviteEmail(opts: {
  title: string
  description?: string
  location?: string
  meetingLink?: string
  startAt: string | Date
  endAt: string | Date
  organizerName: string
}): string {
  const start = new Date(opts.startAt)
  const end = new Date(opts.endAt)
  const dateStr = start.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Nairobi' })
  const timeStr = `${start.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })} - ${end.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })}`
  return `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;">
      <h1 style="color:#4a463d;font-size:20px;margin:0 0 4px;">${opts.title}</h1>
      <p style="color:#766c59;font-size:13px;margin:0 0 20px;">Invited by ${opts.organizerName}</p>
      <table style="width:100%;font-size:14px;color:#14120e;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#766c59;width:90px;">Date</td><td style="padding:6px 0;">${dateStr}</td></tr>
        <tr><td style="padding:6px 0;color:#766c59;">Time</td><td style="padding:6px 0;">${timeStr} (EAT)</td></tr>
        ${opts.location ? `<tr><td style="padding:6px 0;color:#766c59;">Location</td><td style="padding:6px 0;">${opts.location}</td></tr>` : ''}
        ${opts.meetingLink ? `<tr><td style="padding:6px 0;color:#766c59;">Link</td><td style="padding:6px 0;"><a href="${opts.meetingLink}">${opts.meetingLink}</a></td></tr>` : ''}
      </table>
      ${opts.description ? `<p style="color:#423c31;font-size:14px;line-height:1.6;margin-top:20px;">${opts.description}</p>` : ''}
      <p style="color:#948a75;font-size:12px;margin-top:24px;">A calendar invite (.ics) is attached, open it to add this to your calendar.</p>
    </div>
  `
}
