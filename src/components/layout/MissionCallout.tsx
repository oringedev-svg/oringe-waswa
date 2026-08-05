import Link from 'next/link'

type Props = {
  eyebrow: string
  title: string
  description: string
  primaryHref: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
}

// A firm-specific mission panel: inspired by the clarity of an editorial
// recruitment hero, without borrowing another organisation's brand or copy.
export default function MissionCallout({ eyebrow, title, description, primaryHref, primaryLabel, secondaryHref, secondaryLabel }: Props) {
  return <section className="mission-callout">
    <div className="mission-callout-image" aria-hidden="true" />
    <div className="mission-callout-scrim" />
    <div className="container mission-callout-content">
      <span className="mission-callout-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="mission-callout-actions">
        <Link href={primaryHref} className="mission-callout-primary">{primaryLabel}</Link>
        {secondaryHref && secondaryLabel && (
          <Link href={secondaryHref} className="mission-callout-secondary">{secondaryLabel}</Link>
        )}
      </div>
    </div>
  </section>
}
