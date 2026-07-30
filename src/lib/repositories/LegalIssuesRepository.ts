/**
 * Legal Issues Repository
 *
 * Manages Legal Issues linked to Matter Records.
 * Legal Issues can have multiple Arguments (pro/con).
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface LegalIssue {
  id: string
  matterId: string
  issueType: string
  title: string
  description: string
  severity: IssueSeverity
  sourceActivityId?: string
  createdAt: Date
  updatedAt: Date
}

export interface LegalIssuesRepository {
  createIssue(data: Omit<LegalIssue, 'id' | 'createdAt' | 'updatedAt'>): Promise<LegalIssue>
  updateIssue(
    issueId: string,
    data: Partial<Omit<LegalIssue, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<LegalIssue>
  deleteIssue(issueId: string): Promise<void>
  getIssue(issueId: string): Promise<LegalIssue | null>
  getIssuesByMatter(matterId: string): Promise<LegalIssue[]>
}

export class PostgresLegalIssuesRepository implements LegalIssuesRepository {
  constructor(private supabase: SupabaseClient) {}

  async createIssue(data: Omit<LegalIssue, 'id' | 'createdAt' | 'updatedAt'>): Promise<LegalIssue> {
    const { data: result, error } = await this.supabase
      .from('legal_issues')
      .insert([
        {
          matter_id: data.matterId,
          issue_type: data.issueType,
          title: data.title,
          description: data.description,
          severity: data.severity,
          source_activity_id: data.sourceActivityId,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      matterId: result.matter_id,
      issueType: result.issue_type,
      title: result.title,
      description: result.description,
      severity: result.severity,
      sourceActivityId: result.source_activity_id,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }
  }

  async updateIssue(
    issueId: string,
    data: Partial<Omit<LegalIssue, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<LegalIssue> {
    const updateData: Record<string, any> = {}
    if (data.title) updateData.title = data.title
    if (data.description) updateData.description = data.description
    if (data.severity) updateData.severity = data.severity

    const { data: result, error } = await this.supabase
      .from('legal_issues')
      .update(updateData)
      .eq('id', issueId)
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      matterId: result.matter_id,
      issueType: result.issue_type,
      title: result.title,
      description: result.description,
      severity: result.severity,
      sourceActivityId: result.source_activity_id,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }
  }

  async deleteIssue(issueId: string): Promise<void> {
    const { error } = await this.supabase
      .from('legal_issues')
      .delete()
      .eq('id', issueId)

    if (error) throw error
  }

  async getIssue(issueId: string): Promise<LegalIssue | null> {
    const { data, error } = await this.supabase
      .from('legal_issues')
      .select('*')
      .eq('id', issueId)
      .single()

    if (error && error.code === 'PGRST116') return null
    if (error) throw error

    return {
      id: data.id,
      matterId: data.matter_id,
      issueType: data.issue_type,
      title: data.title,
      description: data.description,
      severity: data.severity,
      sourceActivityId: data.source_activity_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  }

  async getIssuesByMatter(matterId: string): Promise<LegalIssue[]> {
    const { data, error } = await this.supabase
      .from('legal_issues')
      .select('*')
      .eq('matter_id', matterId)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      matterId: row.matter_id,
      issueType: row.issue_type,
      title: row.title,
      description: row.description,
      severity: row.severity,
      sourceActivityId: row.source_activity_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  }
}
