/**
 * PostgreSQL Implementation of ConflictEngineRepository
 *
 * Stores and manages proposed conflict results from the Conflict Engine.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { ConflictEngineRepository, ConflictResult } from './ConflictEngineRepository'

export class PostgresConflictEngineRepository implements ConflictEngineRepository {
  constructor(private supabase: SupabaseClient) {}

  async saveConflict(conflict: Omit<ConflictResult, 'id' | 'createdAt'>): Promise<ConflictResult> {
    const { data, error } = await this.supabase
      .from('conflict_engine_results')
      .insert([
        {
          matter_id: conflict.matterId,
          status: conflict.status,
          related_matters: conflict.relatedMatters,
          related_people: conflict.relatedPeople,
          conflict_type: conflict.conflictType,
          description: conflict.description,
          source_event: conflict.sourceEvent,
          computed_at: conflict.computedAt?.toISOString(),
        },
      ])
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      matterId: data.matter_id,
      status: data.status,
      relatedMatters: data.related_matters || [],
      relatedPeople: data.related_people || [],
      conflictType: data.conflict_type,
      description: data.description,
      sourceEvent: data.source_event,
      computedAt: new Date(data.computed_at),
      createdAt: new Date(data.created_at),
    }
  }

  async getProposedConflicts(matterId?: string): Promise<ConflictResult[]> {
    let query = this.supabase
      .from('conflict_engine_results')
      .select('*')
      .eq('status', 'proposed')

    if (matterId) {
      query = query.eq('matter_id', matterId)
    }

    const { data, error } = await query.order('computed_at', { ascending: false })

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      matterId: row.matter_id,
      status: row.status,
      relatedMatters: row.related_matters || [],
      relatedPeople: row.related_people || [],
      conflictType: row.conflict_type,
      description: row.description,
      sourceEvent: row.source_event,
      computedAt: new Date(row.computed_at),
      createdAt: new Date(row.created_at),
    }))
  }

  async getAllConflicts(matterId?: string): Promise<ConflictResult[]> {
    let query = this.supabase.from('conflict_engine_results').select('*')

    if (matterId) {
      query = query.eq('matter_id', matterId)
    }

    const { data, error } = await query.order('computed_at', { ascending: false })

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      matterId: row.matter_id,
      status: row.status,
      relatedMatters: row.related_matters || [],
      relatedPeople: row.related_people || [],
      conflictType: row.conflict_type,
      description: row.description,
      sourceEvent: row.source_event,
      computedAt: new Date(row.computed_at),
      createdAt: new Date(row.created_at),
    }))
  }

  async markConflictReviewed(conflictId: string, reviewedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('conflict_engine_results')
      .update({
        status: 'reviewed',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', conflictId)

    if (error) throw error
  }

  async recordFailure(
    conflictId: string,
    failure: { error: string; timestamp: string },
  ): Promise<void> {
    // Record in failures table for debugging
    const { error } = await this.supabase.from('conflict_engine_failures').insert([
      {
        conflict_id: conflictId,
        error_message: failure.error,
        failed_at: failure.timestamp,
      },
    ])

    if (error) throw error
  }
}
