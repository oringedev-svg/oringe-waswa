import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  className?: string
  action?: React.ReactNode
}

export default function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  action,
}: SectionHeaderProps) {
  const centered = align === 'center'

  return (
    <div
      className={cn(
        'section-header reveal',
        centered && 'section-header--center',
        action && 'section-header--with-action',
        className,
      )}
    >
      <div className={cn('section-header-body', centered && 'mx-auto')}>
        {eyebrow && <span className="section-header-eyebrow">{eyebrow}</span>}
        <h2 className="section-header-title">{title}</h2>
        {description && <p className="section-header-desc">{description}</p>}
        {!centered && <div className="grow-line-left rule-accent mt-5" />}
      </div>
      {action && <div className="section-header-action">{action}</div>}
    </div>
  )
}
