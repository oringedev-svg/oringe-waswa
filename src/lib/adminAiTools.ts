import { logAudit } from './audit'

// ============================================================
// ADMIN AI ASSISTANT, Resource Registry
// Single source of truth mapping AI-callable "resources" to the
// real internal API routes. This is what lets the assistant read
// and mutate data safely: every write goes through the SAME
// validated endpoints the admin UI itself uses (so side effects
// like emails, AI moderation, slug generation, etc. still run).
// ============================================================

export type AdminOperation = 'list' | 'get' | 'create' | 'update' | 'delete' | 'send'

export interface ResourceMeta {
  label: string
  description: string
  supportedOps: AdminOperation[]
  // Ops that mutate data, these ALWAYS require human confirmation
  // before executing, regardless of what the model requests.
  writeOps: AdminOperation[]
  fieldHints: string
  filterHints?: string
}

// Resources deliberately NOT included: `settings` and `settings/keys`
// (site configuration & API credentials), never exposed to the AI agent.
// `gallery` and `documents` creation is excluded too, those require
// real binary file uploads the assistant can't supply.
export const RESOURCES: Record<string, ResourceMeta> = {
  team_members: {
    label: 'Team Members',
    description: 'Attorneys/staff shown on the public Team page.',
    supportedOps: ['list', 'get', 'create', 'update', 'delete'],
    writeOps: ['create', 'update', 'delete'],
    fieldHints:
      'full_name, email, phone, position, department, specializations (string[]), bar_number, years_experience, education (array of {degree,institution,year}), bio, is_visible, is_active, display_order',
  },
  blog_posts: {
    label: 'Blog Posts',
    description: 'Blog articles. New posts are created as drafts and pass through AI moderation automatically.',
    supportedOps: ['list', 'get', 'create', 'update', 'delete'],
    writeOps: ['create', 'update', 'delete'],
    fieldHints:
      'title, content, excerpt, category, tags (string[]), status (draft|ready_for_review|approved|scheduled|published|changes_requested|archived), cover_image_url, authors (array of {name,email,role}) where role must be exactly one of: primary, co_author, contributor',
    filterHints: 'status (draft|pending_review|published|rejected|archived|all), category',
  },
  blog_comments: {
    label: 'Blog Comments',
    description: 'Reader comments awaiting moderation on blog posts.',
    supportedOps: ['list', 'update'],
    writeOps: ['update'],
    fieldHints: 'is_approved (boolean), admin_reply (string)',
    filterHints: 'post_id, pending (true = unapproved only)',
  },
  submissions: {
    label: 'Submissions',
    description: 'Contact/job/paper/appointment form submissions from the public site.',
    supportedOps: ['list', 'get', 'create', 'update', 'delete'],
    writeOps: ['create', 'update', 'delete'],
    fieldHints:
      'For update: status (pending|under_review|interview_scheduled|accepted|rejected|completed|on_hold|awaiting_info), message (sent to the client if is_public), is_public (boolean), assigned_to (team member id), internal_notes',
    filterHints: 'type (job|contact|paper|appointment), status',
  },
  appointments: {
    label: 'Appointments',
    description: 'Client consultation bookings.',
    supportedOps: ['list', 'get', 'create', 'update', 'delete'],
    writeOps: ['create', 'update', 'delete'],
    fieldHints:
      'client_name, client_email, client_phone, matter_type, description, status (pending|confirmed|cancelled|completed|no_show), assigned_attorney_id, scheduled_date (YYYY-MM-DD), scheduled_time, duration_minutes, location, meeting_link, notes',
    filterHints: 'status, attorney_id, date (YYYY-MM-DD)',
  },
  legal_matters: {
    label: 'Legal Matters',
    description: 'Open/closed case files.',
    supportedOps: ['list', 'get', 'create', 'update', 'delete'],
    writeOps: ['create', 'update', 'delete'],
    fieldHints:
      'title, type (civil_litigation|criminal_defense|family_law|corporate|property|immigration|employment|intellectual_property|constitutional|alternative_dispute|other), status (open|closed|on_hold|archived), client_name, opposing_party, court, case_number, assigned_attorney_id, description, tags (string[]). Delete archives the matter rather than removing it.',
    filterHints: 'type, status, search',
  },
  legal_documents: {
    label: 'Documents',
    description: 'Metadata for uploaded case documents. New file uploads must be done from the admin UI directly, the assistant can only update metadata or delete existing document records.',
    supportedOps: ['list', 'get', 'update', 'delete'],
    writeOps: ['update', 'delete'],
    fieldHints: 'title, type, description, access_level (public|client|staff|admin|confidential), is_privileged (boolean), tags (string[])',
    filterHints: 'matter_id, type, search',
  },
  people: {
    label: 'People',
    description: 'General profiles (clients, etc., not team/attorney profiles).',
    supportedOps: ['list', 'get', 'create', 'update', 'delete'],
    writeOps: ['create', 'update', 'delete'],
    fieldHints: 'full_name, email, phone, role (admin|staff|moderator|client|public), bio, location, is_active. Delete deactivates rather than removing.',
    filterHints: 'role, search',
  },
  gallery_images: {
    label: 'Gallery',
    description: 'Photo gallery. New images must be uploaded from the admin UI, the assistant can only edit captions/metadata or delete existing images.',
    supportedOps: ['list', 'update', 'delete'],
    writeOps: ['update', 'delete'],
    fieldHints: 'caption, alt_text, category, tags (string[]), is_featured (boolean), display_order',
    filterHints: 'category, featured',
  },
  certificates: {
    label: 'Certificates',
    description: 'Issued certificates (participation, achievement, custom). AI generates the certificate body text automatically on creation.',
    supportedOps: ['list', 'create'],
    writeOps: ['create'],
    fieldHints: 'recipient_id (a profile id, look it up via people first), type (participation|achievement|custom), title, description (achievement summary), issued_by, send_email (boolean, actually emails the recipient)',
    filterHints: 'recipient_id',
  },
  insights: {
    label: 'Insights',
    description: 'Videos, audio, news, and articles shown on the Insights page.',
    supportedOps: ['list', 'create', 'update', 'delete'],
    writeOps: ['create', 'update', 'delete'],
    fieldHints: 'title, type (video|audio|news|article), description, media_url, thumbnail_url, external_url, source, category, tags (string[]), is_featured (boolean), published_at',
    filterHints: 'type, category, featured',
  },
  coverage_areas: {
    label: 'Coverage Areas',
    description: 'Regions shown on the public coverage map.',
    supportedOps: ['list', 'create', 'update', 'delete'],
    writeOps: ['create', 'update', 'delete'],
    fieldHints: 'name, region, country, latitude, longitude, description',
  },
  awards: {
    label: 'Awards',
    description: 'Firm awards and recognitions.',
    supportedOps: ['list', 'create', 'update', 'delete'],
    writeOps: ['create', 'update', 'delete'],
    fieldHints: 'title, issuer, year, description, image_url, is_featured (boolean), display_order',
  },
  events: {
    label: 'Events',
    description: 'Firm events, upcoming or past.',
    supportedOps: ['list', 'create', 'update', 'delete'],
    writeOps: ['create', 'update', 'delete'],
    fieldHints: 'title, description, event_date, end_date, location, image_url, registration_url, status (upcoming|past|cancelled), is_featured (boolean)',
    filterHints: 'status',
  },
  client_resources: {
    label: 'Client Resources',
    description: 'Downloadable resources for clients (guides, forms, reports). File upload must be done from the admin UI, the assistant can only edit metadata for existing resources.',
    supportedOps: ['list', 'update', 'delete'],
    writeOps: ['update', 'delete'],
    fieldHints: 'title, description, category, access_level (public|client|staff)',
    filterHints: 'category',
  },
  mail_subscribers: {
    label: 'Mail Subscribers',
    description: 'Newsletter subscriber list.',
    supportedOps: ['list', 'create', 'delete'],
    writeOps: ['create', 'delete'],
    fieldHints: 'email, name, tags (string[]). Create sends a welcome email. Delete requires an email or id.',
    filterHints: 'active',
  },
  mail_campaigns: {
    label: 'Mail Campaigns',
    description: 'Newsletter campaigns. "send" actually emails every matching active subscriber, irreversible, always confirm carefully.',
    supportedOps: ['list', 'create', 'send'],
    writeOps: ['create', 'send'],
    fieldHints: 'subject, content (HTML), recipient_tags (string[], empty = everyone)',
  },
}

export type ResourceKey = keyof typeof RESOURCES

export interface HttpRequestSpec {
  path: string
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
}

function qs(params?: Record<string, string | undefined>): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (!entries.length) return ''
  return '?' + new URLSearchParams(entries as [string, string][]).toString()
}

/** Builds the request for read-only operations (list/get). Executed immediately, no confirmation needed. */
export function buildReadRequest(
  resource: string,
  op: 'list' | 'get',
  opts: { id?: string; filter?: Record<string, string> }
): HttpRequestSpec | null {
  const { id, filter } = opts
  switch (resource) {
    case 'team_members':
      if (op === 'get' && id) return { path: `/api/team/${id}`, method: 'GET' }
      return { path: `/api/team${qs(filter)}`, method: 'GET' }
    case 'blog_posts':
      if (op === 'get' && id) return { path: `/api/blog/${id}`, method: 'GET' }
      return { path: `/api/blog${qs({ admin: 'true', status: filter?.status || 'all', category: filter?.category, limit: '30' })}`, method: 'GET' }
    case 'blog_comments':
      return { path: `/api/blog/comments${qs({ post_id: filter?.post_id, pending: filter?.pending ?? 'true' })}`, method: 'GET' }
    case 'submissions':
      if (op === 'get' && id) return { path: `/api/submissions/${id}`, method: 'GET' }
      return { path: `/api/submissions${qs({ type: filter?.type, status: filter?.status, limit: '30' })}`, method: 'GET' }
    case 'appointments':
      if (op === 'get' && id) return { path: `/api/appointments/${id}`, method: 'GET' }
      return { path: `/api/appointments${qs({ status: filter?.status, attorney_id: filter?.attorney_id, date: filter?.date, limit: '30' })}`, method: 'GET' }
    case 'legal_matters':
      if (op === 'get' && id) return { path: `/api/files/matters/${id}`, method: 'GET' }
      return { path: `/api/files/matters${qs({ type: filter?.type, status: filter?.status, search: filter?.search, limit: '30' })}`, method: 'GET' }
    case 'legal_documents':
      if (op === 'get' && id) return { path: `/api/files/documents/${id}`, method: 'GET' }
      return { path: `/api/files/documents${qs({ matter_id: filter?.matter_id, type: filter?.type, search: filter?.search })}`, method: 'GET' }
    case 'people':
      if (op === 'get' && id) return { path: `/api/people/${id}`, method: 'GET' }
      return { path: `/api/people${qs({ role: filter?.role, search: filter?.search, limit: '30' })}`, method: 'GET' }
    case 'gallery_images':
      return { path: `/api/gallery${qs({ category: filter?.category, featured: filter?.featured })}`, method: 'GET' }
    case 'certificates':
      return { path: `/api/certificates${qs({ recipient_id: filter?.recipient_id })}`, method: 'GET' }
    case 'insights':
      return { path: `/api/insights${qs({ type: filter?.type, category: filter?.category, featured: filter?.featured, limit: '30' })}`, method: 'GET' }
    case 'coverage_areas':
      return { path: `/api/coverage`, method: 'GET' }
    case 'awards':
      return { path: `/api/awards`, method: 'GET' }
    case 'events':
      return { path: `/api/events${qs({ status: filter?.status })}`, method: 'GET' }
    case 'client_resources':
      return { path: `/api/resources${qs({ category: filter?.category })}`, method: 'GET' }
    case 'mail_subscribers':
      return { path: `/api/mail/subscribers${qs({ active: filter?.active, limit: '30' })}`, method: 'GET' }
    case 'mail_campaigns':
      return { path: `/api/mail/campaigns`, method: 'GET' }
    default:
      return null
  }
}

/** Builds the request for write operations (create/update/delete/send). NEVER executed until a human confirms. */
export function buildWriteRequest(
  resource: string,
  op: 'create' | 'update' | 'delete' | 'send',
  opts: { id?: string; data?: Record<string, unknown> }
): HttpRequestSpec | null {
  const { id, data } = opts || {}
  switch (resource) {
    case 'team_members':
      if (op === 'create') return { path: '/api/team', method: 'POST', body: data }
      if (op === 'update' && id) return { path: `/api/team/${id}`, method: 'PATCH', body: data }
      if (op === 'delete' && id) return { path: `/api/team/${id}`, method: 'DELETE' }
      return null
    case 'blog_posts':
      if (op === 'create') return { path: '/api/blog', method: 'POST', body: data }
      if (op === 'update' && id) return { path: `/api/blog/${id}`, method: 'PATCH', body: data }
      if (op === 'delete' && id) return { path: `/api/blog/${id}`, method: 'DELETE' }
      return null
    case 'blog_comments':
      if (op === 'update' && id) return { path: `/api/blog/comments`, method: 'PATCH', body: { id, ...data } }
      return null
    case 'submissions':
      if (op === 'create') return { path: '/api/submissions', method: 'POST', body: data }
      if (op === 'update' && id) return { path: `/api/submissions/${id}`, method: 'PATCH', body: data }
      if (op === 'delete' && id) return { path: `/api/submissions/${id}`, method: 'DELETE' }
      return null
    case 'appointments':
      if (op === 'create') return { path: '/api/appointments', method: 'POST', body: data }
      if (op === 'update' && id) return { path: `/api/appointments/${id}`, method: 'PATCH', body: data }
      if (op === 'delete' && id) return { path: `/api/appointments/${id}`, method: 'DELETE' }
      return null
    case 'legal_matters':
      if (op === 'create') return { path: '/api/files/matters', method: 'POST', body: data }
      if (op === 'update' && id) return { path: `/api/files/matters/${id}`, method: 'PATCH', body: data }
      if (op === 'delete' && id) return { path: `/api/files/matters/${id}`, method: 'DELETE' }
      return null
    case 'legal_documents':
      if (op === 'update' && id) return { path: `/api/files/documents/${id}`, method: 'PATCH', body: data }
      if (op === 'delete' && id) return { path: `/api/files/documents/${id}`, method: 'DELETE' }
      return null
    case 'people':
      if (op === 'create') return { path: '/api/people', method: 'POST', body: data }
      if (op === 'update' && id) return { path: `/api/people/${id}`, method: 'PATCH', body: data }
      if (op === 'delete' && id) return { path: `/api/people/${id}`, method: 'DELETE' }
      return null
    case 'gallery_images':
      if (op === 'update' && id) return { path: `/api/gallery/${id}`, method: 'PATCH', body: data }
      if (op === 'delete' && id) return { path: `/api/gallery/${id}`, method: 'DELETE' }
      return null
    case 'certificates':
      if (op === 'create') return { path: '/api/certificates', method: 'POST', body: data }
      return null
    case 'insights':
      if (op === 'create') return { path: '/api/insights', method: 'POST', body: data }
      if (op === 'update' && id) return { path: `/api/insights`, method: 'PATCH', body: { id, ...data } }
      if (op === 'delete' && id) return { path: `/api/insights?id=${id}`, method: 'DELETE' }
      return null
    case 'coverage_areas':
      if (op === 'create') return { path: '/api/coverage', method: 'POST', body: data }
      if (op === 'update' && id) return { path: `/api/coverage`, method: 'PATCH', body: { id, ...data } }
      if (op === 'delete' && id) return { path: `/api/coverage?id=${id}`, method: 'DELETE' }
      return null
    case 'awards':
      if (op === 'create') return { path: '/api/awards', method: 'POST', body: data }
      if (op === 'update' && id) return { path: `/api/awards`, method: 'PATCH', body: { id, ...data } }
      if (op === 'delete' && id) return { path: `/api/awards?id=${id}`, method: 'DELETE' }
      return null
    case 'events':
      if (op === 'create') return { path: '/api/events', method: 'POST', body: data }
      if (op === 'update' && id) return { path: `/api/events`, method: 'PATCH', body: { id, ...data } }
      if (op === 'delete' && id) return { path: `/api/events?id=${id}`, method: 'DELETE' }
      return null
    case 'client_resources':
      if (op === 'update' && id) return { path: `/api/resources`, method: 'PATCH', body: { id, ...data } }
      if (op === 'delete' && id) return { path: `/api/resources?id=${id}`, method: 'DELETE' }
      return null
    case 'mail_subscribers':
      if (op === 'create') return { path: '/api/mail/subscribers', method: 'POST', body: data }
      if (op === 'delete') {
        const email = (data as { email?: string })?.email
        if (email) return { path: `/api/mail/subscribers?email=${encodeURIComponent(email)}`, method: 'DELETE' }
        if (id) return { path: `/api/mail/subscribers?id=${id}`, method: 'DELETE' }
      }
      return null
    case 'mail_campaigns':
      if (op === 'create') return { path: '/api/mail/campaigns', method: 'POST', body: data }
      if (op === 'send' && id) return { path: '/api/mail/campaigns', method: 'PUT', body: { id } }
      return null
    default:
      return null
  }
}

export function isValidResource(resource: string): boolean {
  return resource in RESOURCES
}

export function isWriteOpAllowed(resource: string, op: AdminOperation): boolean {
  const meta = RESOURCES[resource]
  return !!meta && meta.writeOps.includes(op)
}

export function isReadOpAllowed(resource: string, op: AdminOperation): boolean {
  const meta = RESOURCES[resource]
  return !!meta && meta.supportedOps.includes(op) && (op === 'list' || op === 'get')
}

// ============================================================
// Tool schema + system prompt for the model
// ============================================================
const RESOURCE_KEYS = Object.keys(RESOURCES)

export function buildToolDefinitions() {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'query_data',
        description:
          'Read data from the firm database. Use this to list records, search, or fetch a single record by id. Always use this to find a real record id before proposing an update, delete, or send action, never guess an id.',
        parameters: {
          type: 'object',
          properties: {
            resource: { type: 'string', enum: RESOURCE_KEYS },
            operation: { type: 'string', enum: ['list', 'get'] },
            id: { type: 'string', description: 'Record id. Required when operation is "get".' },
            filter: {
              type: 'object',
              description: 'Optional filters/search params for "list" (see each resource\'s filter hints). Keys and values must be strings.',
              additionalProperties: { type: 'string' },
            },
          },
          required: ['resource', 'operation'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'propose_action',
        description:
          'Stage a create, update, delete, or send action for the admin to review. This NEVER executes anything by itself, it only prepares a confirmation card that a human must explicitly approve in the UI. Always call query_data first to confirm the target record actually exists and to get its real id.',
        parameters: {
          type: 'object',
          properties: {
            resource: { type: 'string', enum: RESOURCE_KEYS },
            operation: { type: 'string', enum: ['create', 'update', 'delete', 'send'] },
            id: { type: 'string', description: 'Record id. Required for update, delete, and send.' },
            data: {
              type: 'object',
              description: 'Fields to create or update, matching that resource\'s field hints. Omit for delete/send.',
            },
            summary: {
              type: 'string',
              description:
                'One precise, human-readable sentence describing exactly what will happen, e.g. "Update team member Jane Doe: change position to Senior Associate" or "Send campaign \'July Newsletter\' to all active subscribers". This is shown directly to the admin.',
            },
          },
          required: ['resource', 'operation', 'summary'],
        },
      },
    },
  ]
}

export function buildSystemPrompt(): string {
  const lines = Object.entries(RESOURCES)
    .map(([key, meta]) => {
      const ops = meta.supportedOps.join(', ')
      const filters = meta.filterHints ? ` Filters: ${meta.filterHints}.` : ''
      return `- ${key} (${meta.label}): ${meta.description} Ops: ${ops}. Fields: ${meta.fieldHints}.${filters}`
    })
    .join('\n')

  return `You are the internal admin AI assistant for Oringe Waswa & Akude Advocates LLP, a law firm's website back office (Nairobi, Kenya). You help staff manage the firm's data through natural conversation.

You have two tools:
1. query_data, read-only, executes immediately. Use freely to look things up, answer questions, and find real record ids.
2. propose_action, for ANY create/update/delete/send. It never executes by itself; it only stages a confirmation card for a human to approve. You must always call this instead of claiming you've done something.

Rules:
- NEVER say you created/updated/deleted/sent something unless propose_action has been called and the system tells you it was confirmed and executed. Before confirmation, speak in the future/conditional tense ("This will update...", "Ready to..."), not the past tense.
- Always resolve names to real ids via query_data before calling propose_action with an update/delete/send operation. Do not invent ids.
- If a request is ambiguous (e.g. which "John" they mean, which blog post), ask a brief clarifying question or list the matches instead of guessing.
- Keep replies concise and concrete. When you call propose_action, you can also briefly explain your reasoning in the same turn's text, but the actual proposal details belong in the summary field.
- Be extra careful with anything irreversible or high-impact: hard deletes, emailing subscribers, sending mail campaigns. Make sure the summary spells out the impact (e.g. how many recipients).
- Never touch site settings or API keys, you have no tool for those, and you should say so if asked.

Available resources:
${lines}`
}

// ============================================================
// Executing a read-only query against the real internal API
// ============================================================
const MAX_RESPONSE_ITEMS = 15

export async function runQuery(
  origin: string,
  resource: string,
  operation: 'list' | 'get',
  args: { id?: string; filter?: Record<string, string> },
  cookieHeader?: string
): Promise<unknown> {
  const spec = buildReadRequest(resource, operation, args)
  if (!spec) return { error: `Unsupported query: ${resource}.${operation}` }

  const res = await fetch(`${origin}${spec.path}`, {
    method: spec.method,
    cache: 'no-store',
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
  if (!res.ok) {
    return { error: `Query failed (${res.status})` }
  }
  const json = await res.json()

  // Trim large lists so we don't blow the model's context window.
  if (Array.isArray(json)) {
    return { count: json.length, items: json.slice(0, MAX_RESPONSE_ITEMS), truncated: json.length > MAX_RESPONSE_ITEMS }
  }
  if (json && typeof json === 'object' && 'data' in json && Array.isArray((json as { data: unknown[] }).data)) {
    const arr = (json as { data: unknown[] }).data
    return { ...json, data: arr.slice(0, MAX_RESPONSE_ITEMS), truncated: arr.length > MAX_RESPONSE_ITEMS }
  }
  return json
}

// ============================================================
// Executing a confirmed write action against the real internal API
// ============================================================
export async function runAction(
  origin: string,
  resource: string,
  operation: AdminOperation,
  args: { id?: string; data?: Record<string, unknown> },
  cookieHeader?: string
): Promise<{ ok: boolean; status: number; result: unknown }> {
  if (!isValidResource(resource) || !isWriteOpAllowed(resource, operation)) {
    return { ok: false, status: 400, result: { error: `Operation not permitted: ${resource}.${operation}` } }
  }
  const spec = buildWriteRequest(resource, operation as 'create' | 'update' | 'delete' | 'send', args)
  if (!spec) {
    return { ok: false, status: 400, result: { error: `Could not build request for ${resource}.${operation} (missing id or data?)` } }
  }
  const res = await fetch(`${origin}${spec.path}`, {
    method: spec.method,
    headers: {
      ...(spec.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: spec.body ? JSON.stringify(spec.body) : undefined,
    cache: 'no-store',
  })
  let result: unknown = null
  try {
    result = await res.json()
  } catch {
    result = null
  }
  if (res.ok) {
    const tableName = RESOURCE_TABLE_NAMES[resource] || resource
    const recordId =
      args.id || (result && typeof result === 'object' && 'id' in (result as Record<string, unknown>) ? String((result as Record<string, unknown>).id) : null)
    await logAudit({
      table_name: tableName,
      record_id: recordId,
      action: operation === 'create' ? 'INSERT' : operation === 'delete' ? 'DELETE' : 'UPDATE',
      new_data: operation !== 'delete' ? { via: 'admin_ai_assistant', ...args.data } : undefined,
      old_data: operation === 'delete' ? { via: 'admin_ai_assistant' } : undefined,
    })
  }
  return { ok: res.ok, status: res.status, result }
}

const RESOURCE_TABLE_NAMES: Record<string, string> = {
  people: 'profiles',
}
