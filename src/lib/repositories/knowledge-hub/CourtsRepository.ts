/**
 * Courts Knowledge Hub Repository.
 * Read-only interface for reference data that exists independent of any matter.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { NotFoundError, PersistenceError, translatePersistenceError } from '@/lib/errors/DomainError'

export interface Court {
  id: string
  name: string
  type: string
  jurisdiction: string
}

export interface CourtsRepository {
  /**
   * Get a court by ID. Throws NotFoundError if not found.
   */
  getCourt(id: string): Promise<Court>

  /**
   * Get all active courts.
   */
  listCourts(): Promise<Court[]>

  /**
   * Get courts by jurisdiction.
   */
  getCourtsByJurisdiction(jurisdiction: string): Promise<Court[]>
}

export class PostgresCountrRepository implements CourtsRepository {
  constructor(private supabase: SupabaseClient) {}

  async getCourt(id: string): Promise<Court> {
    try {
      const { data, error } = await this.supabase
        .from('courts')
        .select('id, name, type, jurisdiction')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        throw translatePersistenceError(error)
      }

      if (!data) {
        throw new NotFoundError('Court', id)
      }

      return data as Court
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async listCourts(): Promise<Court[]> {
    try {
      const { data, error } = await this.supabase
        .from('courts')
        .select('id, name, type, jurisdiction')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []) as Court[]
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }

  async getCourtsByJurisdiction(jurisdiction: string): Promise<Court[]> {
    try {
      const { data, error } = await this.supabase
        .from('courts')
        .select('id, name, type, jurisdiction')
        .eq('jurisdiction', jurisdiction)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) {
        throw translatePersistenceError(error)
      }

      return (data || []) as Court[]
    } catch (err) {
      if (err instanceof PersistenceError) {
        throw err
      }
      throw translatePersistenceError(err)
    }
  }
}
