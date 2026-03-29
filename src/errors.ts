import type { DownloadError, DownloadErrorCode, DownloadFailure } from './types.js'

export function createDownloadError(
  code: DownloadErrorCode,
  message: string,
  retryable = false,
): DownloadError {
  return {
    code,
    message,
    retryable,
  }
}

export function failure(
  code: DownloadErrorCode,
  message: string,
  retryable = false,
): DownloadFailure {
  return {
    ok: false,
    error: createDownloadError(code, message, retryable),
  }
}
