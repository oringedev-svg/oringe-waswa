/**
 * Judges Admin Repository
 *
 * Write operations for managing judge reference data.
 * Judges have filing preferences (JSONB) that customize deadline calculations.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface JudgeFilingPreferences {
  filing_days_after_hearing?: number
  prefers_electronically_filed_documents?: boolean
  requires_signed_orders?: boolean
}

export interface Judge {
  id: string
  divisionId: string
  fullName: string
  email?: string
  phone?: string
  filingPreferences?: JudgeFilingPreferences
  createdAt: Date
  updatedAt: Date
}

export interface JudgesAdminRepository {
  createJudge(data: Omit<Judge, 'id' | 'createdAt' | 'updatedAt'>): Promise<Judge>
  updateJudge(
    judgeId: string,
    data: Partial<Omit<Judge, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Judge>
  deleteJudge(judgeId: string): Promise<void>
  getJudge(judgeId: string): Promise<Judge | null>
  getJudgesByDivisionId(divisionId: string): Promise<Judge[]>
}

export class PostgresJudgesAdminRepository implements JudgesAdminRepository {
  constructor(private supabase: SupabaseClient) {}

  async createJudge(data: Omit<Judge, 'id' | 'createdAt' | 'updatedAt'>): Promise<Judge> {
    // Verify division exists
    const { data: divisionExists } = await this.supabase
      .from('court_divisions')
      .select('id')
      .eq('id', data.divisionId)
      .single()

    if (!divisionExists) {
      throw new Error(`Division ${data.divisionId} not found`)
    }

    const { data: result, error } = await this.supabase
      .from('judges')
      .insert([
        {
          division_id: data.divisionId,
          full_name: data.fullName,
          email: data.email,
          phone: data.phone,
          filing_preferences: data.filingPreferences || {},
        },
      ])
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      divisionId: result.division_id,
      fullName: result.full_name,
      email: result.email,
      phone: result.phone,
      filingPreferences: result.filing_preferences,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }
  }

  async updateJudge(
    judgeId: string,
    data: Partial<Omit<Judge, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Judge> {
    const updateData: Record<string, any> = {}
    if (data.fullName) updateData.full_name = data.fullName
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.filingPreferences) updateData.filing_preferences = data.filingPreferences

    const { data: result, error } = await this.supabase
      .from('judges')
      .update(updateData)
      .eq('id', judgeId)
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      divisionId: result.division_id,
      fullName: result.full_name,
      email: result.email,
      phone: result.phone,
      filingPreferences: result.filing_preferences,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }
  }

  async deleteJudge(judgeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('judges')
      .delete()
      .eq('id', judgeId)

    if (error) throw error
  }

  async getJudge(judgeId: string): Promise<Judge | null> {
    const { data, error } = await this.supabase
      .from('judges')
      .select('*')
      .eq('id', judgeId)
      .single()

    if (error && error.code === 'PGRST116') return null
    if (error) throw error

    return {
      id: data.id,
      divisionId: data.division_id,
      fullName: data.full_name,
      email: data.email,
      phone: data.phone,
      filingPreferences: data.filing_preferences,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  }

  async getJudgesByDivisionId(divisionId: string): Promise<Judge[]> {
    const { data, error } = await this.supabase
      .from('judges')
      .select('*')
      .eq('division_id', divisionId)
      .order('full_name', { ascending: true })

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      divisionId: row.division_id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      filingPreferences: row.filing_preferences,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  }
}
