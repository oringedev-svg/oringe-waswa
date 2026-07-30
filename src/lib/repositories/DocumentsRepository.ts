/**
 * Documents Repository
 *
 * Manages documents uploaded and associated with matters.
 * Each document can be processed by the Document Intelligence Engine.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type DocumentType = 'complaint' | 'motion' | 'brief' | 'order' | 'contract' | 'other'

export interface Document {
  id: string
  matterId: string
  fileName: string
  fileSize: number
  documentType: DocumentType
  uploadedBy: string
  fileUrl?: string
  metadata?: Record<string, any>
  sourceActivityId?: string
  createdAt: Date
}

export interface DocumentsRepository {
  createDocument(data: Omit<Document, 'id' | 'createdAt'>): Promise<Document>
  getDocument(documentId: string): Promise<Document | null>
  getDocumentsByMatter(matterId: string): Promise<Document[]>
  getUnprocessedDocuments(): Promise<Document[]>
  markDocumentProcessed(documentId: string): Promise<void>
}

export class PostgresDocumentsRepository implements DocumentsRepository {
  constructor(private supabase: SupabaseClient) {}

  async createDocument(data: Omit<Document, 'id' | 'createdAt'>): Promise<Document> {
    const { data: result, error } = await this.supabase
      .from('documents')
      .insert([
        {
          matter_id: data.matterId,
          file_name: data.fileName,
          file_size: data.fileSize,
          document_type: data.documentType,
          uploaded_by: data.uploadedBy,
          file_url: data.fileUrl,
          metadata: data.metadata || {},
          source_activity_id: data.sourceActivityId,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return {
      id: result.id,
      matterId: result.matter_id,
      fileName: result.file_name,
      fileSize: result.file_size,
      documentType: result.document_type,
      uploadedBy: result.uploaded_by,
      fileUrl: result.file_url,
      metadata: result.metadata,
      sourceActivityId: result.source_activity_id,
      createdAt: new Date(result.created_at),
    }
  }

  async getDocument(documentId: string): Promise<Document | null> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (error && error.code === 'PGRST116') return null
    if (error) throw error

    return {
      id: data.id,
      matterId: data.matter_id,
      fileName: data.file_name,
      fileSize: data.file_size,
      documentType: data.document_type,
      uploadedBy: data.uploaded_by,
      fileUrl: data.file_url,
      metadata: data.metadata,
      sourceActivityId: data.source_activity_id,
      createdAt: new Date(data.created_at),
    }
  }

  async getDocumentsByMatter(matterId: string): Promise<Document[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('matter_id', matterId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      matterId: row.matter_id,
      fileName: row.file_name,
      fileSize: row.file_size,
      documentType: row.document_type,
      uploadedBy: row.uploaded_by,
      fileUrl: row.file_url,
      metadata: row.metadata,
      sourceActivityId: row.source_activity_id,
      createdAt: new Date(row.created_at),
    }))
  }

  async getUnprocessedDocuments(): Promise<Document[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(10) // Fetch up to 10 unprocessed documents

    if (error) throw error

    return (data || []).map((row: any) => ({
      id: row.id,
      matterId: row.matter_id,
      fileName: row.file_name,
      fileSize: row.file_size,
      documentType: row.document_type,
      uploadedBy: row.uploaded_by,
      fileUrl: row.file_url,
      metadata: row.metadata,
      sourceActivityId: row.source_activity_id,
      createdAt: new Date(row.created_at),
    }))
  }

  async markDocumentProcessed(documentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('documents')
      .update({
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (error) throw error
  }
}
