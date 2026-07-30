/**
 * Deadline Engine Repository
 * Stores proposed filing deadlines computed from hearing dates and judge preferences.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { PersistenceError, translatePersistenceError } from '@/lib/errors/DomainError'
import { logger } from '@/lib/logging/logger'

export interface Deadline {
  id: string
  matterId: string
  status: 'proposed' | 'promoted' | 'rejected'
  deadlineType: 'filing' | 'response' | 'appearance' | 'other'
  dueDate: Date
  description: string
  sourceEvent: string
  sourceHearingId: string
  computedAt: Date
  promotedAt: Date | null
  rejectedBy: string | null
  rejectedAt: Date | null
}

export interface DeadlineEngineRepository {
  /**
   * Store a proposed deadline.
   */
  saveDeadline(deadline: Omit<Deadline, 'id' | 'promotedAt'>): Promise<Deadline>

  /**
   * Get all proposed deadlines for a matter.
   */
  getProposedDeadlines(matterId: string): Promise<Deadline[]>

  /**
   * Get all deadlines for a matter (all statuses).
   */
  getAllDeadlines(matterId: string): Promise<Deadline[]>

  /**
   * Get deadlines approaching (due within N days).
   */
  getUpcomingDeadlines(days: number): Promise<Deadline[]>

  /**
   * Mark a deadline as promoted (accepted).
   */
  promoteDeadline(deadlineId: string): Promise<void>

  /**
   * Mark a deadline as rejected.
   */
  rejectDeadline(deadlineId: string, rejectedBy: string): Promise<void>
}

export class PostgresDeadlineEngineRepository implements DeadlineEngineRepository {
  constructor(private supabase: SupabaseClient) {}

  async saveDeadline(deadline: Omit<Deadline, 'id' | 'promotedAt'>): Promise<Deadline> {
    try {
      const { data, error } = await this.supabase
        .from('deadline_engine_results')
        .insert([
          {
            matter_id: deadline.matterId,
            status: deadline.status,
            deadline_type: deadline.deadlineType,
            due_date: deadline.dueDate,
            description: deadline.description,
            source_event: deadline.sourceEvent,
            source_hearing_id: deadline.sourceHearingId,
            computed_at: deadline.computedAt,
          },
        ])
        .select()
        .single()

      if (error) {
        throw translatePersistenceError(error)
      }

      if (!data) {
        throw new PersistenceError('Deadline insert returned no data')
      }

      logger.info('Deadline computed and stored', {
        matterId: deadline.matterId,
        dueDate: deadline.dueDate,
        deadlineType: deadline.deadlineType,
      })

      return this.mapToDeadline(data)
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getProposedDeadlines(matterId: string): Promise<Deadline[]> {
    try {
      const { data, error } = await this.supabase
        .from('deadline_engine_results')
        .select('*')
        .eq('matter_id', matterId)
        .eq('status', 'proposed')
        .order('due_date', { ascending: true })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((d) => this.mapToDeadline(d))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getAllDeadlines(matterId: string): Promise<Deadline[]> {
    try {
      const { data, error } = await this.supabase
        .from('deadline_engine_results')
        .select('*')
        .eq('matter_id', matterId)
        .order('due_date', { ascending: true })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((d) => this.mapToDeadline(d))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getUpcomingDeadlines(days: number): Promise<Deadline[]> {
    try {
      const today = new Date()
      const cutoff = new Date(today.getTime() + days * 24 * 60 * 60 * 1000)

      const { data, error } = await this.supabase
        .from('deadline_engine_results')
        .select('*')
        .eq('status', 'proposed')
        .gte('due_date', today.toISOString())
        .lte('due_date', cutoff.toISOString())
        .order('due_date', { ascending: true })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((d) => this.mapToDeadline(d))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async promoteDeadline(deadlineId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('deadline_engine_results')
        .update({
          status: 'promoted',
          promoted_at: new Date(),
        })
        .eq('id', deadlineId)

      if (error) {
        throw translatePersistenceError(error)
      }

      logger.info('Deadline promoted', { deadlineId })
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async rejectDeadline(deadlineId: string, rejectedBy: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('deadline_engine_results')
        .update({
          status: 'rejected',
          rejected_by: rejectedBy,
          rejected_at: new Date(),
        })
        .eq('id', deadlineId)

      if (error) {
        throw translatePersistenceError(error)
      }

      logger.info('Deadline rejected', { deadlineId, rejectedBy })
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  private mapToDeadline(data: any): Deadline {
    return {
      id: data.id,
      matterId: data.matter_id,
      status: data.status,
      deadlineType: data.deadline_type,
      dueDate: new Date(data.due_date),
      description: data.description,
      sourceEvent: data.source_event,
      sourceHearingId: data.source_hearing_id,
      computedAt: new Date(data.computed_at),
      promotedAt: data.promoted_at ? new Date(data.promoted_at) : null,
      rejectedBy: data.rejected_by,
      rejectedAt: data.rejected_at ? new Date(data.rejected_at) : null,
    }
  }
}
