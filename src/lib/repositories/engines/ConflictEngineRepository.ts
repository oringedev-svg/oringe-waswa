/**
 * Conflict Engine Repository
 * Stores proposed conflicts detected by the Conflict Engine.
 *
 * All Engine output is append-only (versioned), never overwrites.
 * Status tracks lifecycle: proposed → reviewed → promoted (or discarded).
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { PersistenceError, translatePersistenceError } from '@/lib/errors/DomainError'
import { logger } from '@/lib/logging/logger'

export interface ConflictResult {
  id: string
  matterId: string
  status: 'proposed' | 'reviewed' | 'promoted' | 'discarded'
  conflictType: 'opposing_party_duplicate' | 'shared_person' | 'related_matter'
  conflictSummary: string
  relatedMatters: string[] // Matter IDs
  relatedPeople: string[] // Profile IDs
  sourceEvent: string // Event that triggered this result (matter_created, matter_person_added)
  computedAt: Date
  promotedAt: Date | null
  reviewedBy: string | null
  reviewedAt: Date | null
}

export interface ConflictEngineRepository {
  /**
   * Store a proposed conflict.
   * Multiple results can exist for one matter (one per conflict detected).
   */
  saveConflict(conflict: Omit<ConflictResult, 'id' | 'promotedAt'>): Promise<ConflictResult>

  /**
   * Get all proposed conflicts for a matter.
   */
  getProposedConflicts(matterId: string): Promise<ConflictResult[]>

  /**
   * Get all conflicts for a matter (all statuses).
   */
  getAllConflicts(matterId: string): Promise<ConflictResult[]>

  /**
   * Mark a conflict as reviewed.
   */
  markConflictReviewed(
    conflictId: string,
    reviewedBy: string,
    newStatus: 'promoted' | 'discarded',
  ): Promise<void>

  /**
   * Record an engine failure (for debugging).
   */
  recordFailure(matterId: string, error: string): Promise<void>
}

export class PostgresConflictEngineRepository implements ConflictEngineRepository {
  constructor(private supabase: SupabaseClient) {}

  async saveConflict(
    conflict: Omit<ConflictResult, 'id' | 'promotedAt'>,
  ): Promise<ConflictResult> {
    try {
      const { data, error } = await this.supabase
        .from('conflict_engine_results')
        .insert([
          {
            matter_id: conflict.matterId,
            status: conflict.status,
            conflict_type: conflict.conflictType,
            conflict_summary: conflict.conflictSummary,
            related_matters: conflict.relatedMatters,
            related_people: conflict.relatedPeople,
            source_event: conflict.sourceEvent,
            computed_at: conflict.computedAt,
          },
        ])
        .select()
        .single()

      if (error) {
        throw translatePersistenceError(error)
      }

      if (!data) {
        throw new PersistenceError('ConflictResult insert returned no data')
      }

      logger.info('Conflict detected and stored', {
        matterId: conflict.matterId,
        conflictType: conflict.conflictType,
        sourceEvent: conflict.sourceEvent,
      })

      return this.mapToConflictResult(data)
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getProposedConflicts(matterId: string): Promise<ConflictResult[]> {
    try {
      const { data, error } = await this.supabase
        .from('conflict_engine_results')
        .select('*')
        .eq('matter_id', matterId)
        .eq('status', 'proposed')
        .order('computed_at', { ascending: false })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((c) => this.mapToConflictResult(c))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getAllConflicts(matterId: string): Promise<ConflictResult[]> {
    try {
      const { data, error } = await this.supabase
        .from('conflict_engine_results')
        .select('*')
        .eq('matter_id', matterId)
        .order('computed_at', { ascending: false })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((c) => this.mapToConflictResult(c))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async markConflictReviewed(
    conflictId: string,
    reviewedBy: string,
    newStatus: 'promoted' | 'discarded',
  ): Promise<void> {
    try {
      const updates: any = {
        status: newStatus,
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
      }

      if (newStatus === 'promoted') {
        updates.promoted_at = new Date()
      }

      const { error } = await this.supabase
        .from('conflict_engine_results')
        .update(updates)
        .eq('id', conflictId)

      if (error) {
        throw translatePersistenceError(error)
      }

      logger.info('Conflict reviewed', {
        conflictId,
        newStatus,
        reviewedBy,
      })
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async recordFailure(matterId: string, error: string): Promise<void> {
    try {
      await this.supabase.from('conflict_engine_failures').insert([
        {
          matter_id: matterId,
          error_message: error,
          occurred_at: new Date(),
        },
      ])

      logger.error('Conflict engine failure recorded', new Error(error), {
        matterId,
      })
    } catch (err) {
      // Don't throw here; this is just for debugging
      logger.error('Failed to record conflict engine failure', err as Error, {
        matterId,
      })
    }
  }

  private mapToConflictResult(data: any): ConflictResult {
    return {
      id: data.id,
      matterId: data.matter_id,
      status: data.status,
      conflictType: data.conflict_type,
      conflictSummary: data.conflict_summary,
      relatedMatters: data.related_matters || [],
      relatedPeople: data.related_people || [],
      sourceEvent: data.source_event,
      computedAt: new Date(data.computed_at),
      promotedAt: data.promoted_at ? new Date(data.promoted_at) : null,
      reviewedBy: data.reviewed_by,
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : null,
    }
  }
}
