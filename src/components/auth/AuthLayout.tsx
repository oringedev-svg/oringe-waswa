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
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-page">
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
    </div>
  )
}
