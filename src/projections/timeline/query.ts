/**
 * Timeline Projection Query
 *
 * Pure read-only query that displays the history of a matter.
 * Composes data from matter_stage_history and hearings tables.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface TimelineEntry {
  id: string
  matterId: string
  type: 'stage_change' | 'hearing_scheduled' | 'deadline_set' | 'conflict_detected' | 'note'
  title: string
  description: string
  timestamp: Date
  actor?: string
  metadata?: Record<string, any>
}

export interface TimelineQuery {
  /**
   * Get all timeline events for a matter, ordered by timestamp.
   */
  getTimelineForMatter(matterId: string): Promise<TimelineEntry[]>

  /**
   * Get recent timeline events across all matters the user has access to.
   */
  getRecentTimeline(limit: number): Promise<TimelineEntry[]>

  /**
   * Get timeline events within a date range.
   */
  getTimelineByDateRange(matterId: string, startDate: Date, endDate: Date): Promise<TimelineEntry[]>
}

export class PostgresTimelineQuery implements TimelineQuery {
  constructor(private supabase: SupabaseClient) {}

  async getTimelineForMatter(matterId: string): Promise<TimelineEntry[]> {
    // Fetch stage history
    const { data: stageHistory, error: stageError } = await this.supabase
      .from('matter_stage_history')
      .select('*')
      .eq('matter_id', matterId)
      .order('created_at', { ascending: false })

    if (stageError) throw stageError

    // Fetch hearings
    const { data: hearings, error: hearingError } = await this.supabase
      .from('hearings')
      .select('id, matter_id, hearing_date, purpose, created_at')
      .eq('matter_id', matterId)
      .eq('deleted_at', null)
      .order('created_at', { ascending: false })

    if (hearingError) throw hearingError

    const entries: TimelineEntry[] = []

    // Map stage history to timeline entries
    if (stageHistory) {
      for (const sh of stageHistory) {
        entries.push({
          id: sh.id,
          matterId: sh.matter_id,
          type: 'stage_change',
          title: `Moved to ${sh.stage_name}`,
          description: `Matter progressed to ${sh.stage_name}`,
          timestamp: new Date(sh.created_at),
          metadata: {
            fromStage: sh.previous_stage,
            toStage: sh.stage_name,
          },
        })
      }
    }

    // Map hearings to timeline entries
    if (hearings) {
      for (const h of hearings) {
        entries.push({
          id: h.id,
          matterId: h.matter_id,
          type: 'hearing_scheduled',
          title: `Hearing scheduled: ${h.purpose}`,
          description: `${h.purpose} scheduled for ${new Date(h.hearing_date).toDateString()}`,
          timestamp: new Date(h.created_at),
          metadata: {
            purpose: h.purpose,
            hearingDate: h.hearing_date,
          },
        })
      }
    }

    // Sort by timestamp descending
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return entries
  }

  async getRecentTimeline(limit: number): Promise<TimelineEntry[]> {
    // Fetch recent stage changes
    const { data: stageHistory, error: stageError } = await this.supabase
      .from('matter_stage_history')
      .select('*, legal_matters(title)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (stageError) throw stageError

    // Fetch recent hearings
    const { data: hearings, error: hearingError } = await this.supabase
      .from('hearings')
      .select('id, matter_id, hearing_date, purpose, created_at, legal_matters(title)')
      .eq('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (hearingError) throw hearingError

    const entries: TimelineEntry[] = []

    // Map stage history
    if (stageHistory) {
      for (const sh of stageHistory) {
        entries.push({
          id: sh.id,
          matterId: sh.matter_id,
          type: 'stage_change',
          title: `${sh.legal_matters?.title || 'Matter'} → ${sh.stage_name}`,
          description: `Matter progressed to ${sh.stage_name}`,
          timestamp: new Date(sh.created_at),
          metadata: {
            matterTitle: sh.legal_matters?.title,
            toStage: sh.stage_name,
          },
        })
      }
    }

    // Map hearings
    if (hearings) {
      for (const h of hearings) {
        entries.push({
          id: h.id,
          matterId: h.matter_id,
          type: 'hearing_scheduled',
          title: `${h.legal_matters?.title || 'Matter'}: ${h.purpose}`,
          description: `Hearing scheduled for ${new Date(h.hearing_date).toDateString()}`,
          timestamp: new Date(h.created_at),
          metadata: {
            matterTitle: h.legal_matters?.title,
            purpose: h.purpose,
          },
        })
      }
    }

    // Sort by timestamp descending and limit
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    return entries.slice(0, limit)
  }

  async getTimelineByDateRange(
    matterId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TimelineEntry[]> {
    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()

    // Fetch stage history in range
    const { data: stageHistory, error: stageError } = await this.supabase
      .from('matter_stage_history')
      .select('*')
      .eq('matter_id', matterId)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })

    if (stageError) throw stageError

    // Fetch hearings in range
    const { data: hearings, error: hearingError } = await this.supabase
      .from('hearings')
      .select('*')
      .eq('matter_id', matterId)
      .eq('deleted_at', null)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })

    if (hearingError) throw hearingError

    const entries: TimelineEntry[] = []

    if (stageHistory) {
      for (const sh of stageHistory) {
        entries.push({
          id: sh.id,
          matterId: sh.matter_id,
          type: 'stage_change',
          title: `Moved to ${sh.stage_name}`,
          description: `Matter progressed to ${sh.stage_name}`,
          timestamp: new Date(sh.created_at),
        })
      }
    }

    if (hearings) {
      for (const h of hearings) {
        entries.push({
          id: h.id,
          matterId: h.matter_id,
          type: 'hearing_scheduled',
          title: `Hearing: ${h.purpose}`,
          description: `${h.purpose} scheduled for ${new Date(h.hearing_date).toDateString()}`,
          timestamp: new Date(h.created_at),
        })
      }
    }

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    return entries
  }
}
