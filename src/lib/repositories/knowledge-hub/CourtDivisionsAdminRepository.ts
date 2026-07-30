/**
 * Court Divisions Admin Repository
 *
 * Write operations for managing court division reference data.
 * Court divisions are hierarchical under courts.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface CourtDivision {
  id: string
  courtId: string
  name: string
  divisionCode: string
  address?: string
  phone?: string
  createdAt: Date
  updatedAt: Date
}

export interface CourtDivisionsAdminRepository {
  createDivision(data: Omit<CourtDivision, 'id' | 'createdAt' | 'updatedAt'>): Promise<CourtDivision>
  updateDivision(
    divisionId: string,
    data: Partial<Omit<CourtDivision, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CourtDivision>
  deleteDivision(divisionId: string): Promise<void>
  getDivision(divisionId: string): Promise<CourtDivision | null>
  getDivisionsByCourtId(courtId: string): Promise<CourtDivision[]>
}

export class PostgresCourtDivisionsAdminRepository implements CourtDivisionsAdminRepository {
  constructor(private supabase: SupabaseClient) {}

  async createDivision(
    data: Omit<CourtDivision, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CourtDivision> {
    // Verify court exists
    const { data: courtExists } = await this.supabase
      .from('courts')
      .select('id')
      .eq('id', data.courtId)
      .single()

    if (!courtExists) {
      throw new Error(`Court ${data.courtId} not found`)
    }

    const { data: result, error } = await this.supabase
      .from('court_divisions')
      .insert([
        {
          court_id: data.courtId,
          name: data.name,
          division_code: data.divisionCode,
          address: data.address,
          phone: data.phone,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      courtId: result.court_id,
      name: result.name,
      divisionCode: result.division_code,
      address: result.address,
      phone: result.phone,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }
  }

  async updateDivision(
    divisionId: string,
    data: Partial<Omit<CourtDivision, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CourtDivision> {
    const updateData: Record<string, any> = {}
    if (data.name) updateData.name = data.name
    if (data.divisionCode) updateData.division_code = data.divisionCode
    if (data.address !== undefined) updateData.address = data.address
    if (data.phone !== undefined) updateData.phone = data.phone

    const { data: result, error } = await this.supabase
      .from('court_divisions')
      .update(updateData)
      .eq('id', divisionId)
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      courtId: result.court_id,
      name: result.name,
      divisionCode: result.division_code,
      address: result.address,
      phone: result.phone,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }
  }

  async deleteDivision(divisionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('court_divisions')
      .delete()
      .eq('id', divisionId)

    if (error) throw error
  }

  async getDivision(divisionId: string): Promise<CourtDivision | null> {
    const { data, error } = await this.supabase
      .from('court_divisions')
      .select('*')
      .eq('id', divisionId)
      .single()

    if (error && error.code === 'PGRST116') return null
    if (error) throw error

    return {
      id: data.id,
      courtId: data.court_id,
      name: data.name,
      divisionCode: data.division_code,
      address: data.address,
      phone: data.phone,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  }

  async getDivisionsByCourtId(courtId: string): Promise<CourtDivision[]> {
    const { data, error } = await this.supabase
      .from('court_divisions')
      .select('*')
      .eq('court_id', courtId)
      .order('name', { ascending: true })

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      courtId: row.court_id,
      name: row.name,
      divisionCode: row.division_code,
      address: row.address,
      phone: row.phone,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  }
}
