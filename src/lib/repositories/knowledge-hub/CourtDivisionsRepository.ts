/**
 * Court Divisions Knowledge Hub Repository.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { NotFoundError, PersistenceError, translatePersistenceError } from '@/lib/errors/DomainError'

export interface CourtDivision {
  id: string
  courtId: string
  name: string
  description: string | null
}

export interface CourtDivisionsRepository {
  /**
   * Get a court division by ID. Throws NotFoundError if not found.
   */
  getCourtDivision(id: string): Promise<CourtDivision>

  /**
   * Get all divisions for a court.
   */
  getCourtDivisionsByCourtId(courtId: string): Promise<CourtDivision[]>

  /**
   * Validate that a division belongs to a court.
   */
  validateDivisionBelongsToCourtl(divisionId: string, courtId: string): Promise<boolean>
}

export class PostgresCourtDivisionsRepository implements CourtDivisionsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getCourtDivision(id: string): Promise<CourtDivision> {
    try {
      const { data, error } = await this.supabase
        .from('court_divisions')
        .select('id, court_id, name, description')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        throw translatePersistenceError(error)
      }

      if (!data) {
        throw new NotFoundError('CourtDivision', id)
      }

      return {
        id: data.id,
        courtId: data.court_id,
        name: data.name,
        description: data.description,
      }
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getCourtDivisionsByCourtId(courtId: string): Promise<CourtDivision[]> {
    try {
      const { data, error } = await this.supabase
        .from('court_divisions')
        .select('id, court_id, name, description')
        .eq('court_id', courtId)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []).map((d) => ({
        id: d.id,
        courtId: d.court_id,
        name: d.name,
        description: d.description,
      }))
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async validateDivisionBelongsToCourtl(divisionId: string, courtId: string): Promise<boolean> {
    try {
      const division = await this.getCourtDivision(divisionId)
      return division.courtId === courtId
    } catch (err) {
      if (err instanceof NotFoundError) {
        return false
      }
      throw err
    }
  }
}
