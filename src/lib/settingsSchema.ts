// ============================================================
// GLOBAL CONFIGURATION ENGINE, Settings Schema
// Single source of truth for every configurable field described
// in the "Global Configuration Engine" spec (firm identity, contact,
// branding, footer, homepage, SEO defaults, social media).
// Each field maps 1:1 to a row in `site_settings` (key/value JSONB),
// so nothing new needs to change in the database schema.
// ============================================================

export type SettingFieldType = 'text' | 'textarea' | 'color' | 'url' | 'image' | 'select' | 'links' | 'stats' | 'phones' | 'emails' | 'nav-menu' | 'footer-columns'

export interface SettingField {
  key: string
  label: string
  type: SettingFieldType
  default: unknown
  help?: string
  options?: string[] // for type=select
}

export interface NavMenuItem {
  label: string
  href: string
  hasSubmenu?: boolean
}

export interface FooterLinkItem {
  label: string
  href: string
}

export interface SettingGroup {
  id: string
  label: string
  description: string
  fields: SettingField[]
}

export const SETTINGS_SCHEMA: SettingGroup[] = [
  {
    id: 'firm',
    label: 'Firm Identity',
    description: 'Who the firm is, used across the header, footer, and page metadata.',
    fields: [
      { key: 'firm_name', label: 'Firm Name', type: 'text', default: 'Oringe Waswa & Akude Advocates LLP' },
      { key: 'firm_logo_url', label: 'Logo URL', type: 'image', default: '' },
      { key: 'firm_favicon_url', label: 'Favicon URL', type: 'image', default: '' },
      { key: 'firm_tagline', label: 'Slogan', type: 'text', default: 'Justice. Integrity. Excellence.' },
      { key: 'firm_description', label: 'Short Description', type: 'textarea', default: "Kenya's trusted legal counsel, serving clients across East Africa." },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    description: 'How clients reach the firm. Shown in the footer, contact page, and booking flows.',
    fields: [
      { key: 'contact_phones', label: 'Phone Number(s)', type: 'phones', default: ['+254 700 000 000'] },
      { key: 'contact_emails', label: 'Email(s)', type: 'emails', default: ['info@oringewaswa.co.ke'] },
      { key: 'contact_whatsapp', label: 'WhatsApp Number', type: 'text', default: '' },
      { key: 'firm_address', label: 'Physical Address', type: 'textarea', default: 'Nairobi, Kenya' },
      { key: 'contact_maps_url', label: 'Google Maps Link', type: 'url', default: '' },
      { key: 'contact_office_hours', label: 'Office Hours', type: 'text', default: 'Mon–Fri, 8:00 AM – 5:00 PM' },
    ],
  },
  {
    id: 'branding',
    label: 'Branding',
    description: 'Visual identity. Changes here update the CSS custom properties driving the whole site.',
    fields: [
      { key: 'brand_primary_color', label: 'Primary Color', type: 'color', default: '#1a1610' },
      { key: 'brand_secondary_color', label: 'Secondary Color', type: 'color', default: '#7a6f5e' },
      { key: 'brand_accent_color', label: 'Accent Color', type: 'color', default: '#c8952a' },
      { key: 'brand_background_color', label: 'Background Color', type: 'color', default: '#faf8f5' },
      { key: 'brand_font_heading', label: 'Heading Font', type: 'text', default: 'Playfair Display' },
      { key: 'brand_font_body', label: 'Body Font', type: 'text', default: 'Inter' },
      { key: 'brand_radius', label: 'Border Radius', type: 'select', default: 'sm', options: ['none', 'sm', 'md', 'lg', 'full'] },
      { key: 'brand_button_style', label: 'Button Style', type: 'select', default: 'solid', options: ['solid', 'outline', 'rounded', 'square'] },
    ],
  },
  {
    id: 'footer',
    label: 'Footer',
    description: 'Content shown at the bottom of every public page.',
    fields: [
      { key: 'footer_copyright', label: 'Copyright Text', type: 'text', default: 'All rights reserved. | Advocates and Solicitors' },
      { key: 'footer_text', label: 'Footer Blurb', type: 'textarea', default: 'Justice. Integrity. Excellence. Serving Kenya and East Africa with comprehensive legal services.' },
      { key: 'footer_links', label: 'Footer Links', type: 'links', default: [
        { label: 'Privacy Policy', url: '/privacy' },
        { label: 'Terms of Service', url: '/terms' },
        { label: 'Disclaimer', url: '/disclaimer' },
      ] },
    ],
  },
  {
    id: 'homepage',
    label: 'Homepage',
    description: 'The hero section and stats band on the homepage.',
    fields: [
      { key: 'home_hero_title', label: 'Hero Title', type: 'text', default: 'Justice. Integrity. Excellence.' },
      { key: 'home_hero_subtitle', label: 'Hero Subtitle', type: 'textarea', default: "Kenya's trusted legal counsel. We deliver comprehensive legal services with precision, integrity, and unwavering commitment to your rights across East Africa." },
      { key: 'home_hero_cta_text', label: 'Hero CTA Text', type: 'text', default: 'Book a Consultation' },
      { key: 'home_hero_cta_link', label: 'Hero CTA Link', type: 'text', default: '/appointments' },
      { key: 'home_hero_image_url', label: 'Hero Image URL', type: 'image', default: '' },
      // Video highlight band. Empty by default: with no URL the band shows
      // the "See our impact" arrow panel over the poster image rather than
      // promising a highlight reel the firm does not have yet. Set a URL
      // and the same band becomes click-to-play, no code change needed.
      { key: 'home_video_url', label: 'Video Highlight URL', type: 'url', default: '' },
      { key: 'home_video_poster', label: 'Video Highlight Poster Image', type: 'image', default: '' },
      { key: 'home_video_impact_link', label: 'Video Band "See Our Impact" Link', type: 'text', default: '/case-results' },
      { key: 'home_video_title', label: 'Video Highlight Title', type: 'text', default: 'How we work with our clients' },
      // Figures carried over from the firm's previous site, which stated
      // "2500++ Solved Cases" outright and lists 9 practice areas and 6
      // team members. Nothing there supports a years-in-practice, office
      // count, or satisfaction percentage, so none are seeded here.
      { key: 'home_stats', label: 'Statistics', type: 'stats', default: [
        { label: 'Solved Cases', value: 2500, suffix: '++' },
        { label: 'Practice Areas', value: 9, suffix: '' },
        { label: 'Team Members', value: 6, suffix: '' },
      ] },
      { key: 'home_cta_eyebrow', label: 'CTA Eyebrow', type: 'text', default: 'Get Started Today' },
      { key: 'home_cta_title', label: 'CTA Title', type: 'text', default: 'Ready to Discuss Your Legal Matter?' },
      { key: 'home_cta_subtitle', label: 'CTA Subtitle', type: 'textarea', default: "Book a confidential consultation with one of our experienced attorneys. We're here to help." },
      { key: 'home_cta_primary_label', label: 'CTA Primary Button Text', type: 'text', default: 'Book a Consultation' },
      { key: 'home_cta_primary_link', label: 'CTA Primary Button Link', type: 'text', default: '/appointments' },
      { key: 'home_cta_secondary_label', label: 'CTA Secondary Button Text', type: 'text', default: 'Contact Us' },
      { key: 'home_cta_secondary_link', label: 'CTA Secondary Button Link', type: 'text', default: '/contact' },
    ],
  },
  {
    id: 'navigation',
    label: 'Navigation',
    description: 'The main menu and footer link columns shown on every public page.',
    fields: [
      // No "Home", the logo/wordmark always routes there. Blog folds under
      // Insights as one public-facing concept (they stay separate content
      // engines internally; /blog/[slug] permalinks still work). Must match
      // the fallback constants in Navbar.tsx / Footer.tsx exactly, since this
      // default is what server-renders before the client-side settings
      // fetch resolves.
      { key: 'nav_main_links', label: 'Main Menu', type: 'nav-menu', default: [
        { label: 'Services', href: '/services', hasSubmenu: true },
        { label: 'Team', href: '/team' },
        { label: 'Insights', href: '/insights' },
        { label: 'Contact', href: '/contact' },
      ] },
      { key: 'footer_nav_columns', label: 'Footer Link Columns', type: 'footer-columns', default: [
        [
          { label: 'Team', href: '/team' },
          { label: 'Insights', href: '/insights' },
          { label: 'Awards', href: '/awards' },
        ],
        [
          { label: 'Practice Areas', href: '/services' },
          { label: 'Family Law', href: '/services#family-law' },
          { label: 'Corporate Law', href: '/services#corporate' },
        ],
        [
          { label: 'Events', href: '/events' },
          { label: 'Client Resources', href: '/resources' },
        ],
        [
          { label: 'Contact', href: '/contact' },
          { label: 'Book Appointment', href: '/appointments' },
          { label: 'Track Submission', href: '/track' },
        ],
      ] },
    ],
  },
  {
    id: 'seo',
    label: 'SEO Defaults',
    description: 'Fallback metadata used on any page that does not define its own.',
    fields: [
      { key: 'seo_default_title', label: 'Default Title', type: 'text', default: 'Oringe Waswa & Akude Advocates LLP' },
      { key: 'seo_default_description', label: 'Default Description', type: 'textarea', default: "Kenya's trusted legal counsel serving clients across East Africa." },
      { key: 'seo_default_keywords', label: 'Default Keywords', type: 'text', default: 'law firm Kenya, advocates Nairobi, legal services East Africa' },
      { key: 'seo_og_image', label: 'Default OpenGraph Image', type: 'image', default: '' },
      { key: 'seo_robots', label: 'Robots Directive', type: 'select', default: 'index,follow', options: ['index,follow', 'noindex,nofollow', 'index,nofollow', 'noindex,follow'] },
    ],
  },
  {
    id: 'social',
    label: 'Social Media',
    description: 'Links shown as icons in the footer.',
    fields: [
      { key: 'social_linkedin', label: 'LinkedIn URL', type: 'url', default: '' },
      { key: 'social_facebook', label: 'Facebook URL', type: 'url', default: '' },
      { key: 'social_instagram', label: 'Instagram URL', type: 'url', default: '' },
      { key: 'social_x', label: 'X (Twitter) URL', type: 'url', default: '' },
      { key: 'social_youtube', label: 'YouTube URL', type: 'url', default: '' },
    ],
  },
]

export function allSettingKeys(): string[] {
  return SETTINGS_SCHEMA.flatMap((g) => g.fields.map((f) => f.key))
}

export function defaultSettingsMap(): Record<string, unknown> {
  const map: Record<string, unknown> = {}
  for (const group of SETTINGS_SCHEMA) {
    for (const field of group.fields) map[field.key] = field.default
  }
  return map
}
