/**
 * Document Intelligence Engine Repository
 *
 * Stores proposed extractions from documents.
 * The engine processes PDFs/text and proposes structured data.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface DocumentExtraction {
  id: string
  documentId: string
  matterId: string
  status: 'proposed' | 'promoted' | 'rejected'
  extractedText: string
  proposedCaseSummary?: string
  proposedKeyDates?: string[]
  proposedParties?: string[]
  proposedIssues?: string[]
  confidence: number // 0-100
  sourceEvent: string
  computedAt: Date
  promotedAt?: Date
  rejectedBy?: string
  rejectedAt?: Date
  createdAt: Date
}

export interface DocumentIntelligenceEngineRepository {
  saveExtraction(data: Omit<DocumentExtraction, 'id' | 'createdAt'>): Promise<DocumentExtraction>
  getProposedExtractions(matterId?: string): Promise<DocumentExtraction[]>
  getAllExtractions(matterId?: string): Promise<DocumentExtraction[]>
  promoteExtraction(extractionId: string, promotedBy: string): Promise<void>
  rejectExtraction(extractionId: string, rejectedBy: string): Promise<void>
}

export class PostgresDocumentIntelligenceEngineRepository
  implements DocumentIntelligenceEngineRepository
{
  constructor(private supabase: SupabaseClient) {}

  async saveExtraction(
    data: Omit<DocumentExtraction, 'id' | 'createdAt'>,
  ): Promise<DocumentExtraction> {
    const { data: result, error } = await this.supabase
      .from('document_intelligence_results')
      .insert([
        {
          document_id: data.documentId,
          matter_id: data.matterId,
          status: data.status,
          extracted_text: data.extractedText,
          proposed_case_summary: data.proposedCaseSummary,
          proposed_key_dates: data.proposedKeyDates,
          proposed_parties: data.proposedParties,
          proposed_issues: data.proposedIssues,
          confidence: data.confidence,
          source_event: data.sourceEvent,
          computed_at: data.computedAt?.toISOString(),
        },
      ])
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      documentId: result.document_id,
      matterId: result.matter_id,
      status: result.status,
      extractedText: result.extracted_text,
      proposedCaseSummary: result.proposed_case_summary,
      proposedKeyDates: result.proposed_key_dates || [],
      proposedParties: result.proposed_parties || [],
      proposedIssues: result.proposed_issues || [],
      confidence: result.confidence,
      sourceEvent: result.source_event,
      computedAt: new Date(result.computed_at),
      createdAt: new Date(result.created_at),
    }
  }

  async getProposedExtractions(matterId?: string): Promise<DocumentExtraction[]> {
    let query = this.supabase
      .from('document_intelligence_results')
      .select('*')
      .eq('status', 'proposed')

    if (matterId) {
      query = query.eq('matter_id', matterId)
    }

    const { data, error } = await query.order('computed_at', { ascending: false })

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      matterId: row.matter_id,
      status: row.status,
      extractedText: row.extracted_text,
      proposedCaseSummary: row.proposed_case_summary,
      proposedKeyDates: row.proposed_key_dates || [],
      proposedParties: row.proposed_parties || [],
      proposedIssues: row.proposed_issues || [],
      confidence: row.confidence,
      sourceEvent: row.source_event,
      computedAt: new Date(row.computed_at),
      createdAt: new Date(row.created_at),
    }))
  }

  async getAllExtractions(matterId?: string): Promise<DocumentExtraction[]> {
    let query = this.supabase.from('document_intelligence_results').select('*')

    if (matterId) {
      query = query.eq('matter_id', matterId)
    }

    const { data, error } = await query.order('computed_at', { ascending: false })

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      matterId: row.matter_id,
      status: row.status,
      extractedText: row.extracted_text,
      proposedCaseSummary: row.proposed_case_summary,
      proposedKeyDates: row.proposed_key_dates || [],
      proposedParties: row.proposed_parties || [],
      proposedIssues: row.proposed_issues || [],
      confidence: row.confidence,
      sourceEvent: row.source_event,
      computedAt: new Date(row.computed_at),
      createdAt: new Date(row.created_at),
    }))
  }

  async promoteExtraction(extractionId: string, promotedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('document_intelligence_results')
      .update({
        status: 'promoted',
        promoted_at: new Date().toISOString(),
      })
      .eq('id', extractionId)

    if (error) throw error
  }

  async rejectExtraction(extractionId: string, rejectedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('document_intelligence_results')
      .update({
        status: 'rejected',
        rejected_by: rejectedBy,
        rejected_at: new Date().toISOString(),
      })
      .eq('id', extractionId)

    if (error) throw error
  }
}
