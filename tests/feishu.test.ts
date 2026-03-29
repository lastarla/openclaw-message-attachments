import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveRuntimeConfig } from '../src/config.js'
import { FeishuAttachmentAdapter } from '../src/adapters/feishu.js'
import type { DownloadRequest } from '../src/types.js'

function createRequest(overrides: Partial<DownloadRequest> = {}): DownloadRequest {
  return {
    attachment: {
      source: 'feishu',
      id: 'file_v3_test',
      name: 'bill.csv',
      source_message_id: 'om_file_msg_123',
      mime_type: 'text/csv',
      size: 12,
      ...(overrides.attachment ?? {}),
    },
    message: overrides.message,
    purpose: overrides.purpose,
  }
}

test('returns invalid_input when source_message_id is missing', async () => {
  const adapter = new FeishuAttachmentAdapter(resolveRuntimeConfig({
    sources: { feishu: { appToken: 'token' } },
  }).sources.feishu)

  const result = await adapter.download(createRequest({
    attachment: { source_message_id: '' } as DownloadRequest['attachment'],
  }))

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error.code, 'invalid_input')
  }
})

test('returns unsupported_type for non-bill attachment in bookkeeping_import', async () => {
  const adapter = new FeishuAttachmentAdapter(resolveRuntimeConfig({
    sources: { feishu: { appToken: 'token' } },
  }).sources.feishu)

  const result = await adapter.download(createRequest({
    purpose: 'bookkeeping_import',
    attachment: { name: 'bill.pdf' } as DownloadRequest['attachment'],
  }))

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error.code, 'unsupported_type')
  }
})

test('downloads attachment and saves to local path from plugin config', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openclaw-attachments-'))
  process.env.OPENCLAW_ATTACHMENTS_ROOT = root

  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(new TextEncoder().encode('a,b\n1,2\n'), {
    status: 200,
    headers: {
      'content-length': '8',
    },
  })

  try {
    const adapter = new FeishuAttachmentAdapter(resolveRuntimeConfig({
      sources: { feishu: { appToken: 'token' } },
    }).sources.feishu)
    const result = await adapter.download(createRequest({ purpose: 'bookkeeping_import' }))

    assert.equal(result.ok, true)
    if (result.ok) {
      const text = await readFile(result.download.local_path, 'utf8')
      assert.equal(text, 'a,b\n1,2\n')
      assert.match(result.download.stored_name, /^om_file_msg_123-/)
      assert.equal(result.download.bytes_written, 8)
    }
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.OPENCLAW_ATTACHMENTS_ROOT
    await rm(root, { recursive: true, force: true })
  }
})

test('falls back to environment variables when plugin config is missing', () => {
  process.env.FEISHU_APP_TOKEN = 'env-token'
  process.env.FEISHU_OPEN_API_BASE = 'https://example.test/open-apis'
  process.env.OPENCLAW_ATTACHMENT_MAX_BYTES = '123'

  try {
    const resolved = resolveRuntimeConfig({})
    assert.equal(resolved.sources.feishu.appToken, 'env-token')
    assert.equal(resolved.sources.feishu.openApiBase, 'https://example.test/open-apis')
    assert.equal(resolved.download.maxBytes, 123)
  } finally {
    delete process.env.FEISHU_APP_TOKEN
    delete process.env.FEISHU_OPEN_API_BASE
    delete process.env.OPENCLAW_ATTACHMENT_MAX_BYTES
  }
})

test('plugin config takes precedence over environment variables', () => {
  process.env.FEISHU_APP_TOKEN = 'env-token'
  process.env.FEISHU_OPEN_API_BASE = 'https://env.test/open-apis'
  process.env.OPENCLAW_ATTACHMENT_MAX_BYTES = '123'

  try {
    const resolved = resolveRuntimeConfig({
      sources: {
        feishu: {
          appToken: 'plugin-token',
          openApiBase: 'https://plugin.test/open-apis',
        },
      },
      download: {
        maxBytes: 456,
      },
    })

    assert.equal(resolved.sources.feishu.appToken, 'plugin-token')
    assert.equal(resolved.sources.feishu.openApiBase, 'https://plugin.test/open-apis')
    assert.equal(resolved.download.maxBytes, 456)
  } finally {
    delete process.env.FEISHU_APP_TOKEN
    delete process.env.FEISHU_OPEN_API_BASE
    delete process.env.OPENCLAW_ATTACHMENT_MAX_BYTES
  }
})
