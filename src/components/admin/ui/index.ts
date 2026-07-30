// Shared admin page primitives. Built on the tokens and classes already in
// globals.css (.card .btn .input .label .badge, --color-*, --status-*) and
// on SECTION_COLORS, so these compose with SectionCard rather than
// competing with it.
export { default as PageHeader } from './PageHeader'
export { default as Modal } from './Modal'
export { default as DataTable, type Column } from './DataTable'
export { default as StatCard } from './StatCard'
export { default as StatusPill, type Tone } from './StatusPill'
export { Toolbar, SearchInput, FilterTabs } from './Toolbar'
export { LoadingState, EmptyState, SetupRequired } from './States'
