// ============================================================
// ORINGE WASWA, Central Type Definitions
// ============================================================

export type UserRole = 'admin' | 'staff' | 'moderator' | 'client' | 'volunteer' | 'public'

export type SubmissionType = 'job' | 'contact' | 'volunteer' | 'paper' | 'appointment'

export type SubmissionStatus =
  | 'pending'
  | 'under_review'
  | 'interview_scheduled'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'on_hold'
  | 'awaiting_info'

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export type BlogStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'

export type MatterType =
  | 'civil_litigation'
  | 'criminal_defense'
  | 'family_law'
  | 'corporate'
  | 'property'
  | 'immigration'
  | 'employment'
  | 'intellectual_property'
  | 'constitutional'
  | 'alternative_dispute'
  | 'other'

export type DocumentType =
  | 'pleading'
  | 'motion'
  | 'brief'
  | 'contract'
  | 'affidavit'
  | 'exhibit'
  | 'correspondence'
  | 'court_order'
  | 'evidence'
  | 'invoice'
  | 'memo'
  | 'research'
  | 'other'

export type FileAccessLevel = 'public' | 'client' | 'staff' | 'admin' | 'confidential'

// ============ PEOPLE ============
export interface Profile {
  id: string
  user_id?: string
  full_name: string
  email: string
  phone?: string
  avatar_url?: string
  role: UserRole
  bio?: string
  location?: string
  linkedin_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TeamMember extends Profile {
  position: string
  department: string
  specializations: string[]
  bar_number?: string
  years_experience?: number
  education?: { degree: string; institution: string; year: number }[]
  display_order: number
  is_visible: boolean
  // The team_members row's own link back to profiles(id), distinct from
  // this interface's inherited `id` (the team_members row's own id).
  // Messaging and other profile-scoped features key off this, not `id`.
  profile_id?: string | null
}

export interface Volunteer {
  id: string
  profile_id: string
  profile?: Profile
  application_id?: string
  status: 'applied' | 'under_review' | 'selected' | 'active' | 'graduated' | 'inactive'
  start_date?: string
  end_date?: string
  department?: string
  supervisor_id?: string
  hours_logged: number
  certificate_issued: boolean
  certificate_url?: string
  notes?: string
  created_at: string
}

// ============ SUBMISSIONS ============
export interface Submission {
  id: string
  tracking_code: string
  type: SubmissionType
  status: SubmissionStatus
  submitter_name: string
  submitter_email: string
  submitter_phone?: string
  data: Record<string, unknown>
  ai_summary?: string
  ai_score?: number
  assigned_to?: string
  assigned_member?: TeamMember
  internal_notes?: string
  created_at: string
  updated_at: string
}

export interface SubmissionUpdate {
  id: string
  submission_id: string
  status: SubmissionStatus
  message: string
  is_public: boolean
  sent_email: boolean
  created_by?: string
  created_at: string
}

// ============ APPOINTMENTS ============
export interface Appointment {
  id: string
  submission_id?: string
  client_name: string
  client_email: string
  client_phone?: string
  matter_type: MatterType
  description: string
  status: AppointmentStatus
  assigned_attorney_id?: string
  assigned_attorney?: TeamMember
  scheduled_date?: string
  scheduled_time?: string
  duration_minutes: number
  location?: string
  meeting_link?: string
  notes?: string
  reminder_sent: boolean
  created_at: string
  updated_at: string
}

// ============ BLOG ============
export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt?: string
  content: string
  cover_image_url?: string
  status: BlogStatus
  category: string
  tags: string[]
  authors: BlogAuthor[]
  moderator_id?: string
  moderator_notes?: string
  views: number
  reading_time_minutes: number
  published_at?: string
  created_at: string
  updated_at: string
}

export interface BlogAuthor {
  id: string
  post_id: string
  profile_id?: string
  name: string
  email?: string
  role: 'primary' | 'co_author' | 'contributor'
  is_external: boolean
  group_name?: string
}

export interface BlogComment {
  id: string
  post_id: string
  parent_id?: string
  author_name: string
  author_email: string
  content: string
  is_approved: boolean
  replies?: BlogComment[]
  created_at: string
}

// ============ FILES / LEGAL DOCS ============
export interface LegalMatter {
  id: string
  matter_number: string
  title: string
  type: MatterType
  status: 'open' | 'closed' | 'on_hold' | 'archived'
  client_id?: string
  client_name: string
  opposing_party?: string
  court?: string
  case_number?: string
  assigned_attorney_id?: string
  assigned_attorney?: TeamMember
  opening_date: string
  closing_date?: string
  description?: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface LegalDocument {
  id: string
  matter_id: string
  matter?: LegalMatter
  title: string
  type: DocumentType
  description?: string
  file_url: string
  file_name: string
  file_size: number
  mime_type: string
  version: number
  is_latest: boolean
  access_level: FileAccessLevel
  uploaded_by?: string
  uploader?: Profile
  tags: string[]
  is_privileged: boolean
  created_at: string
  updated_at: string
}

// ============ GALLERY ============
export interface GalleryImage {
  id: string
  url: string
  thumbnail_url?: string
  caption?: string
  alt_text: string
  category: string
  tags: string[]
  is_featured: boolean
  display_order: number
  uploaded_by?: string
  created_at: string
}

// ============ INSIGHTS (Blog/Video/Audio) ============
export interface InsightItem {
  id: string
  title: string
  type: 'video' | 'audio' | 'news' | 'article'
  description?: string
  media_url?: string
  thumbnail_url?: string
  external_url?: string
  source?: string
  category: string
  tags: string[]
  is_featured: boolean
  published_at: string
  created_at: string
}

// ============ MAIL ============
export interface MailSubscriber {
  id: string
  email: string
  name?: string
  is_active: boolean
  tags: string[]
  subscribed_at: string
  unsubscribed_at?: string
}

export interface MailCampaign {
  id: string
  subject: string
  content: string
  recipient_tags: string[]
  status: 'draft' | 'scheduled' | 'sent'
  sent_count: number
  scheduled_at?: string
  sent_at?: string
  created_by?: string
  created_at: string
}

// ============ CERTIFICATES ============
export interface Certificate {
  id: string
  recipient_id: string
  recipient?: Profile
  type: 'volunteer_graduation' | 'participation' | 'achievement' | 'custom'
  title: string
  description?: string
  issued_date: string
  issued_by?: string
  template_data: Record<string, unknown>
  pdf_url?: string
  is_sent: boolean
  created_at: string
}

// ============ SETTINGS ============
export interface SiteSetting {
  id: string
  key: string
  value: string | Record<string, unknown>
  description?: string
  updated_by?: string
  updated_at: string
}

export interface ApiKey {
  id: string
  name: string
  service: string
  key_preview: string
  is_active: boolean
  created_by?: string
  created_at: string
  last_used?: string
}

// ============ COVERAGE MAP ============
export interface CoverageArea {
  id: string
  name: string
  region: string
  country: string
  latitude: number
  longitude: number
  description?: string
  services: string[]
  is_active: boolean
  created_at: string
}

// ============ CHAT ============
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ============ AI ============
export interface AIConfig {
  model: string
  temperature: number
  max_tokens: number
  system_prompt?: string
}
