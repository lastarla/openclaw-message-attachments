import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plugin } from '../index.js'
import type { DownloadResult } from '../src/types.js'

test('plugin register(api) uses plugin-scoped config and registers tool', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openclaw-plugin-entry-'))
  process.env.OPENCLAW_ATTACHMENTS_ROOT = root

  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(new TextEncoder().encode('a,b\n1,2\n'), {
    status: 200,
    headers: {
      'content-length': '8',
    },
  })

  let registeredTool: {
    name: string
    description: string
    parameters: object
    execute(id: string, params: unknown): Promise<DownloadResult>
  } | undefined

  try {
    plugin.register({
      config: {
        plugins: {
          entries: {
            '@lastarla/openclaw-message-attachments': {
              enabled: true,
              config: {
                sources: {
                  feishu: {
                    appToken: 'plugin-token',
                  },
                },
              },
            },
          },
        },
      },
      registerTool(tool) {
        registeredTool = tool as typeof registeredTool
      },
    })

    assert.ok(registeredTool)
    assert.equal(registeredTool.name, 'message_attachment_download')

    const result = await registeredTool.execute('test-call', {
      attachment: {
        source: 'feishu',
        id: 'file_v3_test',
        name: 'bill.csv',
        source_message_id: 'om_file_msg_123',
        mime_type: 'text/csv',
        size: 8,
      },
      purpose: 'bookkeeping_import',
    })

    assert.equal(result.ok, true)
    if (result.ok) {
      const text = await readFile(result.download.local_path, 'utf8')
      assert.equal(text, 'a,b\n1,2\n')
    }
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.OPENCLAW_ATTACHMENTS_ROOT
    await rm(root, { recursive: true, force: true })
  }
})
