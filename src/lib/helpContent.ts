// Central registry for all in-app help content.
// Used by two surfaces:
//  1. <HelpPanel>, a contextual slide-in drawer that shows the topic
//     matching the page currently being viewed.
//  2. /admin/help, the full administrator manual, which lists every
//     topic grouped by section with a table of contents.
//
// To add help for a new page: add one entry below. `path` is matched as
// a prefix against the current route, so '/admin/blog' also covers
// '/admin/blog/123'. List more specific paths before their parents if a
// page needs its own topic distinct from a section landing page.

export interface HelpSection {
  heading: string
  body: string[]
}

export interface HelpTopic {
  path: string
  title: string
  audience: 'public' | 'admin'
  group: string
  summary: string
  sections: HelpSection[]
  tips?: string[]
}

export const helpTopics: HelpTopic[] = [
  // ───────────────────────────── ADMIN ─────────────────────────────
  {
    path: '/admin/help',
    title: 'Using this manual',
    audience: 'admin',
    group: 'Getting started',
    summary: 'How the admin portal, the help panel, and this manual fit together.',
    sections: [
      {
        heading: 'Two ways to get help',
        body: [
          'Every admin screen has a "?" button in the top bar. It opens a short panel with just the guidance for that screen.',
          'This manual is the same content in one place, organised by section, for when you want to read ahead or search across the whole system.',
        ],
      },
      {
        heading: 'Who can see what',
        body: [
          'Access to each area of the admin portal is controlled by role and by the granular permissions set under Users. If a page or action is missing, it is most likely permissions rather than a bug, check Settings → Users.',
        ],
      },
    ],
  },
  {
    path: '/admin/analytics',
    title: 'Analytics',
    audience: 'admin',
    group: 'Overview',
    summary: 'Traffic, page views, and visitor trends across the public site.',
    sections: [
      {
        heading: 'What you are looking at',
        body: [
          'Page views are recorded automatically by the tracker embedded in the public site layout, no setup needed. The summary card totals views over the selected period; the chart breaks that down by day.',
          'The chat-query box lets you ask a plain-language question about the numbers (e.g. "which page grew the most last week") and get an AI-generated summary drawn from the underlying analytics data.',
        ],
      },
      {
        heading: 'Things to check if numbers look wrong',
        body: [
          'Confirm the date range picker matches what you expect, most confusion comes from an unintentionally narrow range.',
          'Internal/admin traffic is not filtered out by default, so testing on the live site will show up here.',
        ],
      },
    ],
  },
  {
    path: '/admin/submissions',
    title: 'Submissions',
    audience: 'admin',
    group: 'Submissions',
    summary: 'Every contact-form and consultation-request submission from the public site.',
    sections: [
      {
        heading: 'Workflow',
        body: [
          'New submissions arrive with status "pending". Open one to read the full message, assign it, and move it through review to a final status.',
          'Use the AI "Analyze" action on a submission to get a suggested urgency level and category before you triage manually.',
        ],
      },
      {
        heading: 'Bulk actions',
        body: [
          'Select multiple rows with the checkboxes to bulk-assign, bulk-close, or export to CSV from the action bar that appears.',
        ],
      },
    ],
    tips: ['Submissions that sit in "pending" for more than a few days are the most common source of client complaints, sort by date to catch these early.'],
  },
  {
    path: '/admin/appointments',
    title: 'Appointments',
    audience: 'admin',
    group: 'Submissions',
    summary: 'Consultation bookings made through the public Appointments page.',
    sections: [
      {
        heading: 'Confirming a booking',
        body: [
          'New requests appear as "requested". Confirming a slot sends the client an email (via the configured email provider) and moves it to "confirmed".',
          'Cancelling or rescheduling from here updates the client-facing status shown on the public Track page.',
        ],
      },
    ],
  },
  {
    path: '/admin/people',
    title: 'People',
    audience: 'admin',
    group: 'People',
    summary: 'The master directory of clients and contacts linked to matters and submissions.',
    sections: [
      {
        heading: 'How this differs from Team',
        body: [
          'People holds clients and external contacts. Team (below) holds staff and advocates who appear on the public site and have admin access. Keeping these separate avoids client records accidentally becoming public team profiles.',
        ],
      },
    ],
  },
  {
    path: '/admin/team',
    title: 'Team',
    audience: 'admin',
    group: 'People',
    summary: 'Staff and advocate profiles shown on the public Team page, plus their portal access.',
    sections: [
      {
        heading: 'Publishing a profile',
        body: [
          'A team member is only visible on the public site once "published" is toggled on. Draft profiles let you prepare a bio, photo, and credentials before launch.',
          'Revision history is kept for each profile, use "Restore" on an earlier revision if an edit needs to be undone.',
        ],
      },
      {
        heading: 'Portal access',
        body: [
          'Inviting a team member to the admin portal is separate from publishing their public profile, do the former from Users, this page only manages what visitors see.',
        ],
      },
    ],
  },
  {
    path: '/admin/certificates',
    title: 'Certificates',
    audience: 'admin',
    group: 'People',
    summary: 'Credentials and certifications attached to team profiles.',
    sections: [
      {
        heading: 'Usage',
        body: [
          'Certificates added here can be attached to one or more team members and render as credential badges on their public profile.',
        ],
      },
    ],
  },
  {
    // Was /admin/blog/comments, a single firm-wide moderation queue. Comments
    // now live on the post they belong to, so the guidance points at the post
    // editor rather than a page that no longer exists.
    path: '/admin/blog/[id]',
    title: 'Blog comments',
    audience: 'admin',
    group: 'Content',
    summary: 'Visitor comments are moderated on the post they belong to.',
    sections: [
      {
        heading: 'Moderation',
        body: [
          'Comments are held for approval before appearing publicly. Open the post and use its Comments section to approve or reply.',
          'The Comments column on the blog list shows each post’s total, and flags how many are still waiting on approval.',
        ],
      },
    ],
  },
  {
    path: '/admin/blog',
    title: 'Blog',
    audience: 'admin',
    group: 'Content',
    summary: 'Articles published to the public Blog page, with drafts, scheduling, and revision history.',
    sections: [
      {
        heading: 'Editorial workflow',
        body: [
          'Posts move through draft → in review → scheduled/published. Scheduled posts publish automatically at their set time via the publish-scheduled job.',
          'Every save creates a revision. Open "History" on a post to compare or restore an earlier version.',
        ],
      },
      {
        heading: 'Images and SEO',
        body: [
          'Use the media picker for the cover image rather than pasting external URLs, so images stay in the managed Media Library and survive if the source disappears.',
        ],
      },
    ],
  },
  {
    path: '/admin/insights',
    title: 'Insights',
    audience: 'admin',
    group: 'Content',
    summary: 'Shorter-form legal insight pieces shown on the public Insights page, separate from the main Blog.',
    sections: [
      {
        heading: 'When to use Insights vs Blog',
        body: [
          'Use Insights for brief commentary on a single legal development; use Blog for longer-form articles. Both share the same publish/draft mechanics.',
        ],
      },
    ],
  },
  {
    path: '/admin/media',
    title: 'Media Library',
    audience: 'admin',
    group: 'Content',
    summary: 'The shared pool of images used across the public site, team photos, blog covers, hero imagery.',
    sections: [
      {
        heading: 'Why use one library',
        body: [
          'Every image picker across the admin (team, blog, awards, events) pulls from this library, so an image uploaded once can be reused anywhere without re-uploading.',
          '"Usage" on an image shows everywhere it is currently referenced, check this before deleting, since removing an in-use image will break that reference.',
        ],
      },
    ],
  },
  {
    path: '/admin/matters',
    title: 'Legal Matters',
    audience: 'admin',
    group: 'Legal',
    summary: 'Case and matter records, the internal working file behind each client engagement.',
    sections: [
      {
        heading: 'Structure',
        body: [
          'Each matter has a matter number, type, status, and linked client from People. Documents (below) attach to a matter via its ID.',
          'Matter revisions are tracked the same way as blog/team edits, use History to see what changed and by whom.',
        ],
      },
    ],
  },
  {
    path: '/admin/documents',
    title: 'Documents',
    audience: 'admin',
    group: 'Legal',
    summary: 'The document library for legal matters, uploads, privilege flags, and access levels.',
    sections: [
      {
        heading: 'Uploading a document',
        body: [
          'A document must be linked to a matter. Choose the matter first, then upload, the file is stored under that matter and appears in its file list.',
          'Set the access level (staff / partner-only / client-visible) and the privileged flag at upload time; both affect who can see the document later, including in any client-facing portal.',
        ],
      },
      {
        heading: 'Audit trail',
        body: [
          'Every upload, view, and download is written to the document access log automatically, which feeds the Audit Log for compliance review.',
        ],
      },
    ],
    tips: ['Mark anything covered by legal professional privilege as "privileged" at upload, this is the field reviewers check first in a dispute.'],
  },
  {
    path: '/admin/mail',
    title: 'Mail List',
    audience: 'admin',
    group: 'Communications',
    summary: 'Newsletter subscribers and campaign sends.',
    sections: [
      {
        heading: 'Subscribers',
        body: [
          'Subscribers are added automatically from the public MailSignup form, or can be added manually here. Unsubscribes from the public /unsubscribe page update status automatically.',
        ],
      },
      {
        heading: 'Campaigns',
        body: [
          'A campaign is a one-off email sent to some or all active subscribers. Draft, preview, then send, sent campaigns cannot be edited, only duplicated for reuse.',
        ],
      },
    ],
  },
  {
    path: '/admin/messages',
    title: 'Team Messages',
    audience: 'admin',
    group: 'Communications',
    summary: 'Internal messaging between team members, separate from client-facing email.',
    sections: [
      {
        heading: 'Direct vs broadcast',
        body: [
          'A message is either sent to one recipient or marked as a broadcast, which every team member sees. Use broadcasts sparingly, for firm-wide notices rather than routine updates.',
        ],
      },
    ],
  },
  {
    path: '/admin/coverage',
    title: 'Coverage Map',
    audience: 'admin',
    group: 'System',
    summary: 'The regions and practice areas shown on the public coverage map.',
    sections: [
      {
        heading: 'Editing coverage',
        body: [
          'Each region entry controls what is highlighted on the public-facing map component and the short description shown when a visitor selects it.',
        ],
      },
    ],
  },
  {
    path: '/admin/awards',
    title: 'Awards',
    audience: 'admin',
    group: 'System',
    summary: 'Recognitions and awards shown on the public Awards page.',
    sections: [
      {
        heading: 'Featuring an award',
        body: [
          'Mark an award "featured" to have it surfaced in the homepage credentials strip in addition to the full Awards page. Display order controls the sequence.',
        ],
      },
    ],
  },
  {
    path: '/admin/events',
    title: 'Events',
    audience: 'admin',
    group: 'System',
    summary: 'Upcoming and past firm events shown on the public Events page.',
    sections: [
      {
        heading: 'Status',
        body: [
          'Events automatically read as "past" once their date has elapsed, there is no need to manually archive them, though you can still edit past events for record-keeping.',
        ],
      },
    ],
  },
  {
    path: '/admin/resources',
    title: 'Resources',
    audience: 'admin',
    group: 'System',
    summary: 'Downloadable client resources (guides, checklists, forms) shown on the public Resources page.',
    sections: [
      {
        heading: 'Uploading',
        body: [
          'Upload the file first, then fill in the title and description shown publicly. Download counts are tracked automatically per resource.',
        ],
      },
    ],
  },
  {
    path: '/admin/audit-log',
    title: 'Audit Log',
    audience: 'admin',
    group: 'System',
    summary: 'A read-only record of sensitive actions across the portal, logins, permission changes, document access, deletions.',
    sections: [
      {
        heading: 'Reading the log',
        body: [
          'Each entry records who did what, to which record, and when. Use the filters to narrow by user, action type, or date range when investigating an incident.',
          'This log cannot be edited or deleted from the UI by design, so it can be relied on as an authoritative trail.',
        ],
      },
    ],
  },
  {
    path: '/admin/users',
    title: 'Users',
    audience: 'admin',
    group: 'System',
    summary: 'Admin portal accounts, roles, and granular permissions.',
    sections: [
      {
        heading: 'Roles vs permissions',
        body: [
          'Role sets a sensible default level of access. Permissions let you grant or revoke access to a specific area for one user without changing their role, use this for narrow exceptions rather than creating new roles.',
        ],
      },
      {
        heading: 'Inviting someone',
        body: [
          'Invite by email; the invitee receives a link to the accept-invite page to set a password and activate their account.',
        ],
      },
    ],
    tips: ['Review this page periodically and remove access for anyone who has left the firm, the audit log will show if a stale account is ever used.'],
  },
  {
    path: '/admin/settings',
    title: 'Settings',
    audience: 'admin',
    group: 'System',
    summary: 'Site-wide configuration: firm details, branding, integrations, and API keys.',
    sections: [
      {
        heading: 'Public site settings',
        body: [
          'Firm name, logo, contact details and social links set here flow through to the Navbar, Footer, and contact forms on the public site immediately, no redeploy needed.',
        ],
      },
      {
        heading: 'Keys and integrations',
        body: [
          'API keys (email provider, payments, AI features) are stored under Settings → Keys. Keep these current, expired keys are the most common cause of "silent" failures like appointment confirmation emails not sending.',
        ],
      },
    ],
  },
  {
    path: '/admin',
    title: 'Dashboard',
    audience: 'admin',
    group: 'Overview',
    summary: 'The admin home screen, a snapshot of recent activity across the whole portal.',
    sections: [
      {
        heading: 'What is on this screen',
        body: [
          'Cards summarise recent submissions, appointments, and traffic. Use the sidebar to go directly to a section, or the search bar in the top bar to jump to a specific record by name.',
        ],
      },
      {
        heading: 'The AI assistant',
        body: [
          'The assistant icon in the corner can answer questions about the portal and, with confirmation, perform actions on your behalf (e.g. "show me pending submissions from this week").',
        ],
      },
    ],
  },

  // ───────────────────────────── PUBLIC ─────────────────────────────
  {
    path: '/services',
    title: 'Services',
    audience: 'public',
    group: 'Public site',
    summary: 'Practice areas the firm offers, with detail on each.',
    sections: [
      { heading: 'Finding a practice area', body: ['Use the in-page navigation to jump to a specific practice area, or scroll, each area lists the kind of matters handled and how to get in touch about it.'] },
    ],
  },
  {
    path: '/team',
    title: 'Our Team',
    audience: 'public',
    group: 'Public site',
    summary: 'Advocate and staff profiles.',
    sections: [
      { heading: 'Contacting a team member', body: ['Each profile links to the Contact or Appointments page pre-filtered where possible, so an enquiry reaches the right person.'] },
    ],
  },
  {
    path: '/appointments',
    title: 'Book an appointment',
    audience: 'public',
    group: 'Public site',
    summary: 'Request a consultation slot.',
    sections: [
      { heading: 'After you submit', body: ['You will receive a confirmation once the firm accepts the slot. Use the Track page with your reference to check status at any time.'] },
    ],
  },
  {
    path: '/track',
    title: 'Track a submission',
    audience: 'public',
    group: 'Public site',
    summary: 'Check the status of a form submission or appointment using your reference number.',
    sections: [
      { heading: 'Where to find your reference', body: ['The reference number was included in your confirmation email when you submitted the form or booked the appointment.'] },
    ],
  },
  {
    path: '/contact',
    title: 'Contact',
    audience: 'public',
    group: 'Public site',
    summary: 'General enquiries and office details.',
    sections: [
      { heading: 'Response time', body: ['General enquiries are typically triaged within one business day. For a scheduled consultation, use the Appointments page instead.'] },
    ],
  },
  {
    path: '/',
    title: 'Home',
    audience: 'public',
    group: 'Public site',
    summary: 'Overview of the firm, practice areas, team, recent insights, and how to reach us.',
    sections: [
      { heading: 'Getting around', body: ['Use the navigation bar for the full site, or the sections on this page for a quick overview of services, team, and recent writing.'] },
    ],
  },
]

const GENERIC_ADMIN: HelpTopic = {
  path: '',
  title: 'Admin portal',
  audience: 'admin',
  group: 'Overview',
  summary: 'No specific guidance exists for this screen yet.',
  sections: [
    { heading: 'General guidance', body: ['Use the sidebar to navigate between sections. Most list screens share the same pattern: filter/search at the top, bulk actions on selection, and a form drawer for creating or editing a record.'] },
  ],
}

/**
 * Returns the most specific help topic whose `path` is a prefix of the
 * given pathname. Falls back to a generic admin topic for unmapped
 * admin routes, or undefined for unmapped public routes.
 */
export function getHelpForPath(pathname: string): HelpTopic | undefined {
  const candidates = helpTopics
    .filter((t) => pathname === t.path || (t.path !== '/' && pathname.startsWith(t.path)))
    .sort((a, b) => b.path.length - a.path.length)

  if (candidates.length > 0) return candidates[0]
  if (pathname.startsWith('/admin')) return GENERIC_ADMIN
  return undefined
}

export function getTopicsByGroup(audience: 'public' | 'admin') {
  const groups = new Map<string, HelpTopic[]>()
  for (const topic of helpTopics) {
    if (topic.audience !== audience) continue
    if (!groups.has(topic.group)) groups.set(topic.group, [])
    groups.get(topic.group)!.push(topic)
  }
  return groups
}
