import { createAdminClient } from '@/lib/supabase'

export type DocumentContent = File | Buffer
export type StoredDocument = { providerKey: 'owa_storage'; path: string; publicUrl: string }

// All document-handling code uses this boundary. Google Drive or SharePoint
// can later implement the same contract without changing matters, templates
// or assignment delivery flows.
export interface DocumentProvider {
  createDocument(args: { path: string; content: DocumentContent; contentType?: string }): Promise<StoredDocument>
  moveDocument(fromPath: string, toPath: string): Promise<void>
  renameDocument(fromPath: string, toPath: string): Promise<void>
  deleteDocument(path: string): Promise<void>
  shareDocument(path: string): Promise<string>
  getVersions(path: string): Promise<unknown[]>
  downloadDocument(path: string): Promise<Blob>
}

class OwaStorageDocumentProvider implements DocumentProvider {
  private readonly bucket = 'legal-docs'
  private storage() { return createAdminClient().storage.from(this.bucket) }

  async createDocument({ path, content, contentType }: { path: string; content: DocumentContent; contentType?: string }) {
    const { error } = await this.storage().upload(path, content, { contentType, upsert: false })
    if (error) throw error
    return { providerKey: 'owa_storage' as const, path, publicUrl: await this.shareDocument(path) }
  }

  async moveDocument(fromPath: string, toPath: string) {
    const { error } = await this.storage().move(fromPath, toPath)
    if (error) throw error
  }
  async renameDocument(fromPath: string, toPath: string) { await this.moveDocument(fromPath, toPath) }
  async deleteDocument(path: string) {
    const { error } = await this.storage().remove([path])
    if (error) throw error
  }
  async shareDocument(path: string) { return this.storage().getPublicUrl(path).data.publicUrl }
  // Supabase Storage does not expose object versions; callers get a stable
  // empty history until a provider with native versions is configured.
  async getVersions(_: string) { return [] }
  async downloadDocument(path: string) {
    const { data, error } = await this.storage().download(path)
    if (error || !data) throw error || new Error('Document is unavailable')
    return data
  }
}

const owaStorage = new OwaStorageDocumentProvider()
export function getDocumentProvider(key = 'owa_storage'): DocumentProvider {
  if (key !== 'owa_storage') throw new Error(`Unsupported document provider: ${key}`)
  return owaStorage
}
