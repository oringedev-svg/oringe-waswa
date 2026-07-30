/**
 * Calendar Projection Query
 *
 * Pure read-only query that displays hearing dates on a calendar.
 * No new tables needed - data already exists in hearings table.
 * This is a projection layer that composes existing data.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface CalendarEvent {
  id: string
  matterId: string
  matterTitle: string
  hearingDate: Date
  hearingTime: string | null
  purpose: string
  court: string | null
  judge: string | null
  status: string
}

export interface CalendarQuery {
  /**
   * Get all hearings for a matter (for Matter File view).
   */
  getHearingsByMatter(matterId: string): Promise<CalendarEvent[]>

  /**
   * Get all hearings for a user's matters (for Calendar view).
   * Filtered by user's assigned matters.
   */
  getUpcomingHearings(days: number): Promise<CalendarEvent[]>

  /**
   * Get hearings in a date range (for Calendar month view).
   */
  getHearingsByDateRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]>
}

export class PostgresCalendarQuery implements CalendarQuery {
  constructor(private supabase: SupabaseClient) {}

  async getHearingsByMatter(matterId: string): Promise<CalendarEvent[]> {
    const { data, error } = await this.supabase
      .from('hearings')
      .select(
        `
        id,
        matter_id,
        hearing_date,
        hearing_time,
        purpose,
        court,
        legal_matters(title),
        judges(full_name)
      `,
      )
      .eq('matter_id', matterId)
      .eq('deleted_at', null)
      .order('hearing_date', { ascending: true })

    if (error) throw error

    return (data || []).map((h: any) => ({
      id: h.id,
      matterId: h.matter_id,
      matterTitle: h.legal_matters?.title || 'Unknown Matter',
      hearingDate: new Date(h.hearing_date),
      hearingTime: h.hearing_time,
      purpose: h.purpose,
      court: h.court,
      judge: h.judges?.full_name || null,
      status: 'scheduled',
    }))
  }

  async getUpcomingHearings(days: number): Promise<CalendarEvent[]> {
    const today = new Date()
    const cutoff = new Date(today.getTime() + days * 24 * 60 * 60 * 1000)

    const { data, error } = await this.supabase
      .from('hearings')
      .select(
        `
        id,
        matter_id,
        hearing_date,
        hearing_time,
        purpose,
        court,
        status,
        legal_matters(title),
        judges(full_name)
      `,
      )
      .gte('hearing_date', today.toISOString().split('T')[0])
      .lte('hearing_date', cutoff.toISOString().split('T')[0])
      .eq('deleted_at', null)
      .in('status', ['scheduled', 'held'])
      .order('hearing_date', { ascending: true })

    if (error) throw error

    return (data || []).map((h: any) => ({
      id: h.id,
      matterId: h.matter_id,
      matterTitle: h.legal_matters?.title || 'Unknown Matter',
      hearingDate: new Date(h.hearing_date),
      hearingTime: h.hearing_time,
      purpose: h.purpose,
      court: h.court,
      judge: h.judges?.full_name || null,
      status: h.status,
    }))
  }

  async getHearingsByDateRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const { data, error } = await this.supabase
      .from('hearings')
      .select(
        `
        id,
        matter_id,
        hearing_date,
        hearing_time,
        purpose,
        court,
        status,
        legal_matters(title),
        judges(full_name)
      `,
      )
      .gte('hearing_date', startDate.toISOString().split('T')[0])
      .lte('hearing_date', endDate.toISOString().split('T')[0])
      .eq('deleted_at', null)
      .order('hearing_date', { ascending: true })

    if (error) throw error

    return (data || []).map((h: any) => ({
      id: h.id,
      matterId: h.matter_id,
      matterTitle: h.legal_matters?.title || 'Unknown Matter',
      hearingDate: new Date(h.hearing_date),
      hearingTime: h.hearing_time,
      purpose: h.purpose,
      court: h.court,
      judge: h.judges?.full_name || null,
      status: h.status,
    }))
  }
}
