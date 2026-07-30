/**
 * Judges Knowledge Hub Repository.
 * Includes filing preferences (JSONB) that Engines use for deadline computation.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { NotFoundError, PersistenceError, translatePersistenceError } from '@/lib/errors/DomainError'

export interface Judge {
  id: string
  courtDivisionId: string
  fullName: string
  title: string | null
  notes: string | null
  filingPreferences: Record<string, unknown>
}

export interface JudgesRepository {
  /**
   * Get a judge by ID. Throws NotFoundError if not found.
   */
  getJudge(id: string): Promise<Judge>

  /**
   * Get all judges in a division.
   */
  getJudgesByDivisionId(divisionId: string): Promise<Judge[]>

  /**
   * Validate that a judge belongs to a division.
   */
  validateJudgeBelongsToDivision(judgeId: string, divisionId: string): Promise<boolean>
}

export class PostgresJudgesRepository implements JudgesRepository {
  constructor(private supabase: SupabaseClient) {}

  async getJudge(id: string): Promise<Judge> {
    try {
      const { data, error } = await this.supabase
        .from('judges')
        .select('id, court_division_id, full_name, title, notes, filing_preferences')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        throw translatePersistenceError(error)
      }

      if (!data) {
        throw new NotFoundError('Judge', id)
      }

      return {
        id: data.id,
        courtDivisionId: data.court_division_id,
        fullName: data.full_name,
        title: data.title,
        notes: data.notes,
        filingPreferences: data.filing_preferences || {},
      }
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getJudgesByDivisionId(divisionId: string): Promise<Judge[]> {
    try {
      const { data, error } = await this.supabase
        .from('judges')
        .select('id, court_division_id, full_name, title, notes, filing_preferences')
        .eq('court_division_id', divisionId)
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((j) => ({
        id: j.id,
        courtDivisionId: j.court_division_id,
        fullName: j.full_name,
        title: j.title,
        notes: j.notes,
        filingPreferences: j.filing_preferences || {},
      }))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async validateJudgeBelongsToDivision(judgeId: string, divisionId: string): Promise<boolean> {
    try {
      const judge = await this.getJudge(judgeId)
      return judge.courtDivisionId === divisionId
    } catch (err) {
      if (err instanceof NotFoundError) {
        return false
      }
      throw err
    }
  }
}
