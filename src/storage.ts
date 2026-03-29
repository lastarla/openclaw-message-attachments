import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

const DEFAULT_ATTACHMENTS_ROOT = '/root/.openclaw/files/attachments'
const MAX_BASENAME_LENGTH = 120

export function getAttachmentsRoot(): string {
  return process.env.OPENCLAW_ATTACHMENTS_ROOT ?? DEFAULT_ATTACHMENTS_ROOT
}

export function getDateFolder(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function sanitizeFileName(name: string): string {
  const base = basename(name)
  const extension = extname(base)
  const stem = base.slice(0, extension ? -extension.length : undefined)
  const cleanedStem = stem
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[\\/]/g, '-')
    .replace(/\.{2,}/g, '.')
    .trim()
    .slice(0, MAX_BASENAME_LENGTH)

  const safeStem = cleanedStem || 'attachment'
  return `${safeStem}${extension}`
}

export function buildStoredName(sourceMessageId: string | undefined, originalName: string): string {
  const safeName = sanitizeFileName(originalName)
  const prefix = sourceMessageId?.trim() || `${Date.now()}-${randomUUID().slice(0, 8)}`
  return `${prefix}-${safeName}`
}

export async function saveAttachment(params: {
  sourceMessageId?: string
  originalName: string
  bytes: Uint8Array
}): Promise<{
  localPath: string
  storedName: string
  sha256: string
  bytesWritten: number
}> {
  const root = getAttachmentsRoot()
  const folder = join(root, getDateFolder())
  const storedName = buildStoredName(params.sourceMessageId, params.originalName)
  const localPath = join(folder, storedName)

  await mkdir(folder, { recursive: true })
  await writeFile(localPath, params.bytes)

  const sha256 = createHash('sha256').update(params.bytes).digest('hex')

  return {
    localPath,
    storedName,
    sha256,
    bytesWritten: params.bytes.byteLength,
  }
}
