import type { LucideIcon } from 'lucide-react'
import { BookOpen, Users, Scale, Image, MessageSquare, FileText, Award, Calendar, Receipt, Lightbulb, Calculator, Network } from 'lucide-react'

// Maps a permission key to the admin tool it unlocks, this is how a
// restricted account (pupil, administrative assistant) discovers what
// they're actually able to do, without being shown a full admin nav built
// for someone with every permission. Not every permission needs an entry
// here; only ones that correspond to a distinct place to go and work.
export interface PermissionTool {
  href: string
  label: string
  icon: LucideIcon
  description: string
}

export const PERMISSION_TOOLS: Record<string, PermissionTool> = {
  publish_articles: { href: '/admin/blog', label: 'Blog', icon: BookOpen, description: 'Write and publish articles' },
  approve_articles: { href: '/admin/blog', label: 'Blog', icon: BookOpen, description: 'Review and approve submitted articles' },
  manage_lawyers: { href: '/admin/team', label: 'Team', icon: Users, description: 'Manage team profiles' },
  manage_practice_areas: { href: '/admin/practice-areas', label: 'Practice Areas', icon: Scale, description: 'Edit service lines' },
  manage_media: { href: '/admin/media', label: 'Media Library', icon: Image, description: 'Manage images and uploads' },
  manage_testimonials: { href: '/admin/testimonials', label: 'Testimonials', icon: MessageSquare, description: 'Manage client testimonials' },
  manage_forms: { href: '/admin/submissions', label: 'Submissions', icon: FileText, description: 'Triage inquiries from the site' },
  manage_awards: { href: '/admin/awards', label: 'Awards', icon: Award, description: 'Manage recognition and accolades' },
  manage_events: { href: '/admin/events', label: 'Events', icon: Calendar, description: 'Manage firm events' },
  manage_resources: { href: '/admin/resources', label: 'Resources', icon: FileText, description: 'Manage client-facing downloads' },
  manage_matters: { href: '/admin/matters', label: 'Matters', icon: Scale, description: 'Work legal matters through their lifecycle' },
  run_conflict_check: { href: '/admin/matters', label: 'Matters', icon: Scale, description: 'Run conflict checks on matters' },
  log_time: { href: '/admin/matters', label: 'Matters', icon: Scale, description: 'Log billable time on matters' },
  manage_billing: { href: '/admin/invoices', label: 'Invoices', icon: Receipt, description: 'Generate and settle invoices' },
  manage_calendar: { href: '/admin/calendar', label: 'Calendar', icon: Calendar, description: 'Schedule meetings and manage the calendar' },
  manage_users: { href: '/admin/users', label: 'Accounts', icon: Users, description: 'Manage roles and permissions' },
  manage_legal_knowledge: { href: '/admin/knowledge', label: 'Legal Knowledge', icon: Lightbulb, description: 'Maintain the problem/solution library and court routing rules' },
  manage_fee_schedules: { href: '/admin/fee-schedules', label: 'Fee Schedules', icon: Calculator, description: 'Import and edit legal instruments and fee rules' },
  manage_matter_costs: { href: '/admin/matters', label: 'Matters', icon: Scale, description: 'Add and accept cost estimates on matters' },
  manage_organization: { href: '/admin/organization', label: 'Organization', icon: Network, description: 'Configure organizational structure, positions, and legal authorities' },
}

export function toolsForPermissions(permissions: string[]): PermissionTool[] {
  const seen = new Set<string>()
  const tools: PermissionTool[] = []
  for (const key of permissions) {
    const tool = PERMISSION_TOOLS[key]
    if (tool && !seen.has(tool.href)) {
      seen.add(tool.href)
      tools.push(tool)
    }
  }
  return tools
}
