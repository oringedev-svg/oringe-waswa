import { google, drive_v3 } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/drive']

function getConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n')
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  return { email, key, rootFolderId }
}

export function isDriveConfigured(): boolean {
  const { email, key, rootFolderId } = getConfig()
  return Boolean(email && key && rootFolderId)
}

let cachedAuth: InstanceType<typeof google.auth.JWT> | null = null
let cachedDrive: drive_v3.Drive | null = null

function getAuth(): InstanceType<typeof google.auth.JWT> {
  if (cachedAuth) return cachedAuth
  const { email, key } = getConfig()
  if (!email || !key) throw new Error('Google Drive not configured')
  cachedAuth = new google.auth.JWT({ email, key, scopes: SCOPES })
  return cachedAuth
}

function getDriveClient(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive
  cachedDrive = google.drive({ version: 'v3', auth: getAuth() })
  return cachedDrive
}

// ---------------------------------------------------------------------------
// Folder operations
// ---------------------------------------------------------------------------

export async function createMatterFolder(
  matterNumber: string,
  matterTitle: string,
): Promise<{ folderId: string; folderUrl: string }> {
  const drive = getDriveClient()
  const { rootFolderId } = getConfig()

  const folderName = `${matterNumber} — ${matterTitle}`
  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: rootFolderId ? [rootFolderId] : undefined,
    },
    fields: 'id, webViewLink',
  })

  const folderId = res.data.id!
  const folderUrl = res.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`
  return { folderId, folderUrl }
}

// ---------------------------------------------------------------------------
// Document operations
// ---------------------------------------------------------------------------

export async function createGoogleDoc(
  title: string,
  parentFolderId: string,
  templateContent?: string,
): Promise<{ fileId: string; fileUrl: string }> {
  const drive = getDriveClient()

  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: [parentFolderId],
    },
    fields: 'id, webViewLink',
  })

  const fileId = res.data.id!
  const fileUrl = res.data.webViewLink || `https://docs.google.com/document/d/${fileId}/edit`

  if (templateContent) {
    const docs = google.docs({ version: 'v1', auth: getAuth() })
    await docs.documents.batchUpdate({
      documentId: fileId,
      requestBody: {
        requests: [{ insertText: { location: { index: 1 }, text: templateContent } }],
      },
    })
  }

  return { fileId, fileUrl }
}

export async function uploadDocument(
  fileName: string,
  parentFolderId: string,
  content: Buffer,
  mimeType: string,
): Promise<{ fileId: string; fileUrl: string }> {
  const drive = getDriveClient()
  const { Readable } = await import('stream')

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(content),
    },
    fields: 'id, webViewLink',
  })

  const fileId = res.data.id!
  const fileUrl = res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`
  return { fileId, fileUrl }
}

export async function updateDocument(
  fileId: string,
  content: Buffer,
  mimeType: string,
): Promise<void> {
  const drive = getDriveClient()
  const { Readable } = await import('stream')

  await drive.files.update({
    fileId,
    media: {
      mimeType,
      body: Readable.from(content),
    },
  })
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type DriveRole = 'reader' | 'commenter' | 'writer'

export async function setPermission(
  fileId: string,
  email: string,
  role: DriveRole,
): Promise<string> {
  const drive = getDriveClient()

  const res = await drive.permissions.create({
    fileId,
    requestBody: {
      type: 'user',
      role,
      emailAddress: email,
    },
    sendNotificationEmail: false,
    fields: 'id',
  })

  return res.data.id!
}

export async function removePermission(
  fileId: string,
  permissionId: string,
): Promise<void> {
  const drive = getDriveClient()
  await drive.permissions.delete({ fileId, permissionId })
}

export async function listPermissions(
  fileId: string,
): Promise<drive_v3.Schema$Permission[]> {
  const drive = getDriveClient()
  const res = await drive.permissions.list({
    fileId,
    fields: 'permissions(id, emailAddress, role, type)',
  })
  return res.data.permissions || []
}

// ---------------------------------------------------------------------------
// Read / download
// ---------------------------------------------------------------------------

export function getEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`
}

export function getEditUrl(fileId: string): string {
  return `https://docs.google.com/document/d/${fileId}/edit`
}

export async function downloadAsDocx(fileId: string): Promise<Buffer> {
  const drive = getDriveClient()
  const res = await drive.files.export(
    { fileId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { responseType: 'arraybuffer' },
  )
  return Buffer.from(res.data as ArrayBuffer)
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient()
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  )
  return Buffer.from(res.data as ArrayBuffer)
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function getFileMetadata(fileId: string) {
  const drive = getDriveClient()
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, webViewLink, modifiedTime, size',
  })
  return res.data
}
