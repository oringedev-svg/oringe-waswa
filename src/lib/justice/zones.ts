import { Landmark, Shield, Lock, type LucideIcon } from 'lucide-react'
import type { InstitutionType } from './types'

// Colour zoning. Each dataset owns one colour and keeps it in every place
// it appears: hub tile, search result, list page rule, detail page header.
// That is what lets a mixed result list be read by colour instead of by
// reading a type label on every row.
//
// Values are drawn from SECTION_COLORS so the directory sits inside the
// same palette as the rest of the admin rather than beside it.
export const JUSTICE_ZONES: Record<InstitutionType, { hex: string; icon: LucideIcon }> = {
  court: { hex: '#3b6e8f', icon: Landmark },
  'police-station': { hex: '#3f7a5c', icon: Shield },
  prison: { hex: '#6b5580', icon: Lock },
}
