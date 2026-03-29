import type { FeishuAdapterConfig } from '../config.js'
import { failure } from '../errors.js'
import { saveAttachment } from '../storage.js'
import type { AttachmentAdapter, DownloadRequest, DownloadResult } from '../types.js'

const BOOKKEEPING_EXTENSIONS = new Set(['.csv', '.xlsx'])

function getExtension(name: string): string {
  const lastDot = name.lastIndexOf('.')
  if (lastDot < 0) {
    return ''
  }
  return name.slice(lastDot).toLowerCase()
}

function validateInput(input: DownloadRequest, config: FeishuAdapterConfig): DownloadResult | null {
  const { attachment, purpose } = input

  if (attachment.source !== 'feishu') {
    return failure('unsupported_source', `Source '${attachment.source}' is not supported in v1.`)
  }

  if (!attachment.id.trim()) {
    return failure('invalid_input', 'attachment.id is required.')
  }

  if (!attachment.name.trim()) {
    return failure('invalid_input', 'attachment.name is required.')
  }

  if (!attachment.source_message_id.trim()) {
    return failure('invalid_input', 'attachment.source_message_id is required for Feishu downloads.')
  }

  if (purpose === 'bookkeeping_import') {
    const extension = getExtension(attachment.name)
    if (!BOOKKEEPING_EXTENSIONS.has(extension)) {
      return failure('unsupported_type', 'Only csv and xlsx are supported for bookkeeping import.')
    }
  }

  if (attachment.size != null && attachment.size > config.maxBytes) {
    return failure('file_too_large', `Attachment exceeds max size of ${config.maxBytes} bytes.`)
  }

  if (!config.appToken) {
    return failure('permission_denied', 'Feishu app token is not configured for attachment downloads.')
  }

  return null
}

async function fetchAttachmentBytes(input: DownloadRequest, config: FeishuAdapterConfig): Promise<DownloadResult | Uint8Array> {
  const { attachment } = input
  const url = `${config.openApiBase}/im/v1/messages/${encodeURIComponent(attachment.source_message_id)}/resources/${encodeURIComponent(attachment.id)}?type=file`

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.appToken}`,
      },
    })
  } catch (error) {
    return failure('download_failed', error instanceof Error ? error.message : String(error), true)
  }

  if (response.status === 403) {
    return failure('permission_denied', 'Feishu app cannot download this attachment.')
  }

  if (response.status === 404) {
    return failure('not_found', 'Attachment was not found in the source message.')
  }

  if (!response.ok) {
    return failure('download_failed', `Feishu download failed with status ${response.status}.`, response.status >= 500)
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > config.maxBytes) {
    return failure('file_too_large', `Attachment exceeds max size of ${config.maxBytes} bytes.`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > config.maxBytes) {
    return failure('file_too_large', `Attachment exceeds max size of ${config.maxBytes} bytes.`)
  }

  return bytes
}

export class FeishuAttachmentAdapter implements AttachmentAdapter {
  constructor(private readonly config: FeishuAdapterConfig) {}

  async download(input: DownloadRequest): Promise<DownloadResult> {
    const validationError = validateInput(input, this.config)
    if (validationError) {
      return validationError
    }

    const fetched = await fetchAttachmentBytes(input, this.config)
    if (!(fetched instanceof Uint8Array)) {
      return fetched
    }

    try {
      const stored = await saveAttachment({
        sourceMessageId: input.attachment.source_message_id,
        originalName: input.attachment.name,
        bytes: fetched,
      })

      return {
        ok: true,
        attachment: input.attachment,
        download: {
          local_path: stored.localPath,
          stored_name: stored.storedName,
          sha256: stored.sha256,
          bytes_written: stored.bytesWritten,
        },
      }
    } catch (error) {
      return failure('save_failed', error instanceof Error ? error.message : String(error))
    }
  }
}
