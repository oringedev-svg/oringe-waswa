// ============================================================
// SECTION COLOUR PALETTE
// ============================================================
// Extends the four domain colours already used on the dashboard
// (src/app/admin/page.tsx) to every card/section across the admin, so a
// dense page (a matter can carry 10+ cards) is scannable by colour rather
// than reading as one undifferentiated wall of white cards. Colour is
// assigned by what a section IS, not by page:
//
//   blue  , process / tracking (pipelines, lifecycles, workflow state)
//   green , guidance / intelligence (suggestions, recommendations)
//   gold  , money (costs, billing, invoices), same as the Finance domain
//   purple, people (clients, staff, access), same as the Staff domain
//   red   , risk / deadlines (service of process, overdue, declined)
//   slate , records (documents, history, notes, reference material,
//            not something actively worked)
//
// Usage: `border-l-[3px]` on the card + `style={{ borderLeftColor: hex }}`,
// and the section title takes `style={{ color: hex }}`. See SectionCard.tsx
// for the reusable wrapper that also handles collapse state.

export type SectionColor = 'blue' | 'green' | 'gold' | 'purple' | 'red' | 'slate'

export const SECTION_COLORS: Record<SectionColor, string> = {
  blue: '#3b6e8f',
  green: '#3f7a5c',
  gold: '#a97d2f',
  purple: '#6b5580',
  red: '#a3433a',
  slate: '#5c6570',
}
