import { ReactNode } from 'react'
import { Scale } from 'lucide-react'

/**
 * Shared shell for every auth page (login, forgot-password, reset-password,
 * accept-invite).
 *
 * This is the ONE place that defines the structure of an auth screen.
 * All visual values (colors, fonts, sizes, margins, spacing) live in
 * src/styles/auth.css, change them there and every page using this
 * component updates automatically.
 *
 * Structure is a two-panel split: a fixed dark brand panel on the left and
 * the form on the right. The brand panel is decoration only, it never holds
 * a control, which is what makes it safe to drop entirely below the
 * breakpoint in auth.css rather than stacking it above the form.
 */

interface AuthLayoutProps {
  /** Main heading, e.g. "Admin sign in" */
  title: string
  /** Optional line under the title */
  subtitle?: string
  /** Form, message, or loading state to render below the header */
  children: ReactNode
  /** Optional content rendered below everything else, e.g. a "Back to sign in" link */
  footer?: ReactNode
  /** Headline on the brand panel. Defaults to the firm's positioning line. */
  brandTitle?: string
  /** Supporting paragraph on the brand panel. */
  brandText?: string
}

const FIRM_NAME = 'Oringe Waswa & Akude Advocates LLP'

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  brandTitle = 'Counsel, carried end to end.',
  brandText = 'One workspace for every matter the firm carries, from the first enquiry through to the final invoice.',
}: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand-mark">{FIRM_NAME}</div>
        <div className="auth-brand-body">
          <h2 className="auth-brand-title">{brandTitle}</h2>
          <div className="auth-brand-rule" />
          <p className="auth-brand-text">{brandText}</p>
        </div>
        <div className="auth-brand-foot">Nairobi, Kenya</div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <Scale />
            </div>
            <h1 className="auth-title">{title}</h1>
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
