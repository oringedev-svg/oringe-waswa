/**
 * Risk Assessment Engine Repository
 *
 * Stores proposed risk assessments computed by the Risk Assessment Engine.
 * Risk scores are computed from legal issues and their severity.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface RiskAssessment {
  id: string
  matterId: string
  status: 'proposed' | 'promoted' | 'rejected'
  riskScore: number // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: string[] // array of issue types that contributed
  description: string
  sourceEvent: string
  computedAt: Date
  promotedAt?: Date
  rejectedBy?: string
  rejectedAt?: Date
  createdAt: Date
}

export interface RiskAssessmentEngineRepository {
  saveRiskAssessment(data: Omit<RiskAssessment, 'id' | 'createdAt'>): Promise<RiskAssessment>
  getProposedRiskAssessments(matterId?: string): Promise<RiskAssessment[]>
  getAllRiskAssessments(matterId?: string): Promise<RiskAssessment[]>
  promoteRiskAssessment(assessmentId: string, promotedBy: string): Promise<void>
  rejectRiskAssessment(assessmentId: string, rejectedBy: string): Promise<void>
}

export class PostgresRiskAssessmentEngineRepository implements RiskAssessmentEngineRepository {
  constructor(private supabase: SupabaseClient) {}

  async saveRiskAssessment(
    data: Omit<RiskAssessment, 'id' | 'createdAt'>,
  ): Promise<RiskAssessment> {
    const { data: result, error } = await this.supabase
      .from('risk_assessment_results')
      .insert([
        {
          matter_id: data.matterId,
          status: data.status,
          risk_score: data.riskScore,
          risk_level: data.riskLevel,
          factors: data.factors,
          description: data.description,
          source_event: data.sourceEvent,
          computed_at: data.computedAt?.toISOString(),
        },
      ])
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      matterId: result.matter_id,
      status: result.status,
      riskScore: result.risk_score,
      riskLevel: result.risk_level,
      factors: result.factors || [],
      description: result.description,
      sourceEvent: result.source_event,
      computedAt: new Date(result.computed_at),
      createdAt: new Date(result.created_at),
    }
  }

  async getProposedRiskAssessments(matterId?: string): Promise<RiskAssessment[]> {
    let query = this.supabase
      .from('risk_assessment_results')
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
      riskScore: row.risk_score,
      riskLevel: row.risk_level,
      factors: row.factors || [],
      description: row.description,
      sourceEvent: row.source_event,
      computedAt: new Date(row.computed_at),
      createdAt: new Date(row.created_at),
    }))
  }

  async getAllRiskAssessments(matterId?: string): Promise<RiskAssessment[]> {
    let query = this.supabase.from('risk_assessment_results').select('*')

    if (matterId) {
      query = query.eq('matter_id', matterId)
    }

    const { data, error } = await query.order('computed_at', { ascending: false })

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      matterId: row.matter_id,
      status: row.status,
      riskScore: row.risk_score,
      riskLevel: row.risk_level,
      factors: row.factors || [],
      description: row.description,
      sourceEvent: row.source_event,
      computedAt: new Date(row.computed_at),
      createdAt: new Date(row.created_at),
    }))
  }

  async promoteRiskAssessment(assessmentId: string, promotedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('risk_assessment_results')
      .update({
        status: 'promoted',
        promoted_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)

    if (error) throw error
  }

  async rejectRiskAssessment(assessmentId: string, rejectedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('risk_assessment_results')
      .update({
        status: 'rejected',
        rejected_by: rejectedBy,
        rejected_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)

    if (error) throw error
  }
}
