import {
  Globe, Scale, Users, Landmark, BookOpen, Newspaper, MessageSquare, Image,
  Map, Award, Calendar, FileText, Mail, Settings, BarChart2, Folder, Shield,
  Receipt, Clock, Lightbulb, Calculator, Network, Search, TrendingUp, Briefcase, Trophy, HelpCircle,
  Gavel, type LucideIcon,
} from 'lucide-react'

// ============================================================
// THE FOUR DOMAINS
// ============================================================
// The admin is organised as four domains in the order of the value loop:
// the website brings inquiries in, client work carries them, staff do the
// work, finance collects. Each domain is a real destination (a hub page
// hosting its tools), the sidebar shows only the domains, and unfolds
// the one you are working inside.
//
// This file is the single source of truth: the sidebar, the hub pages,
// and the dashboard cards all read from it.

export interface AdminTool {
  href: string
  icon: LucideIcon
  label: string
  description: string
}

export interface AdminDomain {
  key: 'website' | 'clients' | 'staff' | 'finance'
  label: string
  href: string
  icon: LucideIcon
  description: string
  tools: AdminTool[]
  // Extra path prefixes that belong to this domain for highlight/matching
  // but do not appear as their own nav item (e.g. account detail pages).
  aliases?: string[]
}

export const ADMIN_DOMAINS: AdminDomain[] = [
  {
    key: 'website',
    label: 'Website',
    href: '/admin/website',
    icon: Globe,
    description: 'Everything the public sees, content, media, and the channels that bring inquiries in.',
    tools: [
      { href: '/admin/blog', icon: BookOpen, label: 'Blog', description: 'Articles and the editorial workflow' },
      { href: '/admin/insights', icon: Newspaper, label: 'Insights', description: 'Briefs and thought leadership' },
      { href: '/admin/practice-areas', icon: Scale, label: 'Practice Areas', description: 'Service lines shown on the site' },
      { href: '/admin/testimonials', icon: MessageSquare, label: 'Testimonials', description: 'Client words on the homepage' },
      { href: '/admin/case-results', icon: Trophy, label: 'Case Results', description: 'Notable outcomes shown on the homepage' },
      { href: '/admin/media', icon: Image, label: 'Media Library', description: 'Images and uploads' },
      { href: '/admin/coverage', icon: Map, label: 'Coverage Map', description: 'Locations the firm serves' },
      { href: '/admin/awards', icon: Award, label: 'Awards', description: 'Recognition and accolades' },
      { href: '/admin/events', icon: Calendar, label: 'Events', description: 'Firm events and appearances' },
      { href: '/admin/careers', icon: Briefcase, label: 'Careers', description: 'Job openings and applications' },
      { href: '/admin/faqs', icon: HelpCircle, label: 'FAQs', description: 'Common questions shown on the Contact page' },
      { href: '/admin/resources', icon: FileText, label: 'Resources', description: 'Client-facing downloads' },
      { href: '/admin/mail', icon: Mail, label: 'Mail List', description: 'Subscribers and campaigns' },
      { href: '/admin/analytics', icon: BarChart2, label: 'Analytics', description: 'Traffic and engagement' },
      { href: '/admin/settings', icon: Settings, label: 'Site Settings', description: 'Branding, navigation, hero, SEO' },
    ],
  },
  {
    key: 'clients',
    label: 'Clients',
    href: '/admin/clients',
    icon: Scale,
    description: 'No client, no matter. Every enquiry, appointment, matter and document lives under an account here.',
    tools: [
      { href: '/admin/clients', icon: Users, label: 'Client Directory', description: 'Pre-accounts to decide on, then every client account' },
      { href: '/admin/matters', icon: Scale, label: 'Matters', description: 'Case files through their lifecycle' },
      { href: '/admin/court-calendar', icon: Gavel, label: 'Court Calendar', description: 'Every upcoming court appearance across all matters' },
      { href: '/admin/courts', icon: Landmark, label: 'Courts Register', description: 'The controlled list of courts matters are filed in' },
      { href: '/admin/submissions', icon: FileText, label: 'Submissions', description: 'The raw enquiry inbox behind pre-accounts' },
      { href: '/admin/conflict-check', icon: Search, label: 'Conflict Check', description: 'Quick pre-instruction search, before there’s an enquiry or matter to attach it to' },
      { href: '/admin/appointments', icon: Calendar, label: 'Appointments', description: 'Consultation bookings' },
      { href: '/admin/documents', icon: Folder, label: 'Documents', description: 'Matter documents and access levels' },
      { href: '/admin/knowledge', icon: Lightbulb, label: 'Legal Knowledge', description: 'Problem library, suggested solutions, and court routing rules' },
    ],
    // Account detail pages live under /admin/people/[id]; they belong to
    // this domain but are reached from the directory, not a nav item.
    aliases: ['/admin/people'],
  },
  {
    key: 'staff',
    label: 'Staff',
    href: '/admin/staff',
    icon: Users,
    description: 'The people who carry the work, public profiles, accounts, and internal communication.',
    tools: [
      { href: '/admin/calendar', icon: Calendar, label: 'Calendar', description: 'Meetings, court dates, and deadlines, with attendees and notifications' },
      { href: '/admin/team', icon: Shield, label: 'Team', description: 'Public team profiles and bios' },
      { href: '/admin/organization', icon: Network, label: 'Organization', description: 'Structure, positions, legal authorities, and document requirements' },
      { href: '/admin/users', icon: Shield, label: 'Accounts', description: 'Sign-in accounts, roles, permissions' },
      { href: '/admin/messages', icon: MessageSquare, label: 'Team Messages', description: 'Internal notes between staff' },
      { href: '/admin/certificates', icon: Award, label: 'Certificates', description: 'Issue and manage certificates' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    href: '/admin/finance',
    icon: Landmark,
    description: 'Work into cash, billing lives on each matter; this is the firm-wide money picture.',
    tools: [
      { href: '/admin/invoices', icon: Receipt, label: 'Invoices', description: 'Generate, send, and settle invoices' },
      { href: '/admin/matters', icon: Clock, label: 'Time on Matters', description: 'Time is logged on each matter, invoices generate from it there' },
      { href: '/admin/fee-schedules', icon: Calculator, label: 'Fee Schedules', description: 'Legal instruments, fee rules, and cost estimation' },
      { href: '/admin/aro-calculator', icon: Calculator, label: 'ARO Calculator', description: 'Quote a prospective client before a matter exists' },
      { href: '/admin/performance', icon: TrendingUp, label: 'Performance', description: 'Realization, collections, WIP, and ageing receivables, firm-wide' },
    ],
  },
]

/** Which domain a given admin path belongs to, if any. */
export function domainForPath(pathname: string): AdminDomain | undefined {
  return ADMIN_DOMAINS.find(
    (d) =>
      pathname === d.href ||
      d.tools.some((t) => pathname === t.href || pathname.startsWith(t.href + '/')) ||
      (d.aliases || []).some((a) => pathname === a || pathname.startsWith(a + '/'))
  )
}
