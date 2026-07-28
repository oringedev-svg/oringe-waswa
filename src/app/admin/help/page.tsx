'use client'
import { useMemo, useState } from 'react'
import { Search, BookOpen } from 'lucide-react'
import { getTopicsByGroup, HelpTopic } from '@/lib/helpContent'

export default function AdminManualPage() {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => getTopicsByGroup('admin'), [])

  const filtered = useMemo(() => {
    if (!query.trim()) return groups
    const q = query.trim().toLowerCase()
    const result = new Map<string, HelpTopic[]>()
    groups.forEach((topics, group) => {
      const matches = topics.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.sections.some((s) => s.heading.toLowerCase().includes(q) || s.body.some((b) => b.toLowerCase().includes(q)))
      )
      if (matches.length) result.set(group, matches)
    })
    return result
  }, [groups, query])

  const groupOrder = ['Getting started', 'Overview', 'Submissions', 'People', 'Content', 'Legal', 'Communications', 'System']
  const orderedGroups = Array.from(filtered.keys()).sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b))

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="eyebrow mb-2">Administrator manual</p>
          <h1 className="font-display font-semibold" style={{ fontSize: 'var(--heading-page-size)' }}>
            How the portal works
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-2xl">
            Every section of the admin portal, explained. The same content is available contextually via the &ldquo;?&rdquo;
            button on any screen, this page is the full reference in one place.
          </p>
        </div>
      </div>

      <div className="relative mb-10">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          className="input pl-11"
          placeholder="Search the manual, e.g. &quot;permissions&quot;, &quot;privileged&quot;, &quot;scheduled&quot;"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-10">
        {/* TOC */}
        <nav className="hidden md:block sticky top-20 self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)] mb-3">Contents</p>
          <ul className="space-y-1">
            {orderedGroups.map((group) => (
              <li key={group}>
                <a
                  href={`#${slugify(group)}`}
                  className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] py-1 transition-colors"
                >
                  {group}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="space-y-14">
          {orderedGroups.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">No manual entries match &ldquo;{query}&rdquo;.</p>
          )}
          {orderedGroups.map((group) => (
            <section key={group} id={slugify(group)}>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)]">{group}</h2>
                <div className="chrome-divider flex-1" />
              </div>
              <div className="space-y-8">
                {filtered.get(group)!.map((topic) => (
                  <article key={topic.path} className="card p-6">
                    <h3 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-1">{topic.title}</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-4">{topic.summary}</p>
                    <div className="space-y-4">
                      {topic.sections.map((section) => (
                        <div key={section.heading}>
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1.5">{section.heading}</h4>
                          {section.body.map((para, i) => (
                            <p key={i} className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-1.5">
                              {para}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                    {topic.tips && topic.tips.length > 0 && (
                      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] mb-1">Tip</p>
                        {topic.tips.map((tip, i) => (
                          <p key={i} className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{tip}</p>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
