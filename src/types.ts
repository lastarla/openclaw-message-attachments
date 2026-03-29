import type { FeishuAdapterConfig } from './config.js'

export type AttachmentSource = 'feishu'

export type AttachmentRef = {
  source: AttachmentSource
  id: string
  name: string
  source_message_id: string
  mime_type?: string
  size?: number
}

export type MessageContext = {
  message_id?: string
  chat_id?: string
}

export type DownloadPurpose = 'bookkeeping_import' | string

export type DownloadRequest = {
  attachment: AttachmentRef
  message?: MessageContext
  purpose?: DownloadPurpose
}

export type DownloadErrorCode =
  | 'unsupported_source'
  | 'unsupported_type'
  | 'permission_denied'
  | 'not_found'
  | 'download_failed'
  | 'file_too_large'
  | 'save_failed'
  | 'invalid_input'

export type DownloadError = {
  code: DownloadErrorCode
  message: string
  retryable: boolean
}

export type DownloadSuccess = {
  ok: true
  attachment: AttachmentRef
  download: {
    local_path: string
    stored_name: string
    sha256?: string
    bytes_written: number
  }
}

export type DownloadFailure = {
  ok: false
  error: DownloadError
}

export type DownloadResult = DownloadSuccess | DownloadFailure

export type AttachmentAdapter = {
  download(input: DownloadRequest): Promise<DownloadResult>
}

export type AttachmentAdapterRegistry = {
  feishu: AttachmentAdapter
}

export type RuntimeConfig = {
  sources: {
    feishu: FeishuAdapterConfig
  }
  download: {
    maxBytes: number
  }
}
