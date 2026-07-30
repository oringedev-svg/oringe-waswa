/**
 * Courts Admin Repository
 *
 * Write operations for managing court reference data.
 * Only accessible by admin users.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface Court {
  id: string
  name: string
  jurisdiction: string
  address?: string
  phone?: string
  website?: string
  createdAt: Date
  updatedAt: Date
}

export interface CourtsAdminRepository {
  createCourt(data: Omit<Court, 'id' | 'createdAt' | 'updatedAt'>): Promise<Court>
  updateCourt(courtId: string, data: Partial<Omit<Court, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Court>
  deleteCourt(courtId: string): Promise<void>
  getCourt(courtId: string): Promise<Court | null>
  listCourts(jurisdiction?: string): Promise<Court[]>
}

export class PostgresCourtsAdminRepository implements CourtsAdminRepository {
  constructor(private supabase: SupabaseClient) {}

  async createCourt(data: Omit<Court, 'id' | 'createdAt' | 'updatedAt'>): Promise<Court> {
    const { data: result, error } = await this.supabase
      .from('courts')
      .insert([
        {
          name: data.name,
          jurisdiction: data.jurisdiction,
          address: data.address,
          phone: data.phone,
          website: data.website,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      name: result.name,
      jurisdiction: result.jurisdiction,
      address: result.address,
      phone: result.phone,
      website: result.website,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }
  }

  async updateCourt(
    courtId: string,
    data: Partial<Omit<Court, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Court> {
    const updateData: Record<string, any> = {}
    if (data.name) updateData.name = data.name
    if (data.jurisdiction) updateData.jurisdiction = data.jurisdiction
    if (data.address !== undefined) updateData.address = data.address
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.website !== undefined) updateData.website = data.website

    const { data: result, error } = await this.supabase
      .from('courts')
      .update(updateData)
      .eq('id', courtId)
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      name: result.name,
      jurisdiction: result.jurisdiction,
      address: result.address,
      phone: result.phone,
      website: result.website,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }
  }

  async deleteCourt(courtId: string): Promise<void> {
    const { error } = await this.supabase
      .from('courts')
      .delete()
      .eq('id', courtId)

    if (error) throw error
  }

  async getCourt(courtId: string): Promise<Court | null> {
    const { data, error } = await this.supabase
      .from('courts')
      .select('*')
      .eq('id', courtId)
      .single()

    if (error && error.code === 'PGRST116') return null // Not found
    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      jurisdiction: data.jurisdiction,
      address: data.address,
      phone: data.phone,
      website: data.website,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  }

  async listCourts(jurisdiction?: string): Promise<Court[]> {
    let query = this.supabase.from('courts').select('*')

    if (jurisdiction) {
      query = query.eq('jurisdiction', jurisdiction)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      jurisdiction: row.jurisdiction,
      address: row.address,
      phone: row.phone,
      website: row.website,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  }
}
