import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { resolveRuntimeConfig } from '../src/config.js'
import { registerMessageAttachmentDownloadTool } from '../src/tools/message-attachment-download.js'

test('registers message_attachment_download and serves tool calls over MCP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openclaw-mcp-tool-'))
  process.env.OPENCLAW_ATTACHMENTS_ROOT = root

  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(new TextEncoder().encode('a,b\n1,2\n'), {
    status: 200,
    headers: {
      'content-length': '8',
    },
  })

  const server = new McpServer({
    name: 'openclaw-message-attachments-test',
    version: '0.1.0',
  })
  registerMessageAttachmentDownloadTool(server, resolveRuntimeConfig({
    sources: { feishu: { appToken: 'token' } },
  }))

  const client = new Client({
    name: 'openclaw-message-attachments-test-client',
    version: '0.1.0',
  })

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ])

    const toolsResult = await client.request({
      method: 'tools/list',
      params: {},
    }, ListToolsResultSchema)

    assert.ok(toolsResult.tools.some((tool) => tool.name === 'message_attachment_download'))

    const callResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'message_attachment_download',
        arguments: {
          attachment: {
            source: 'feishu',
            id: 'file_v3_test',
            name: 'bill.csv',
            source_message_id: 'om_file_msg_123',
            mime_type: 'text/csv',
            size: 8,
          },
          purpose: 'bookkeeping_import',
        },
      },
    }, CallToolResultSchema)

    assert.equal(callResult.isError, false)
    assert.equal(callResult.content.length, 1)
    assert.equal(callResult.content[0]?.type, 'text')

    const payload = JSON.parse(callResult.content[0]?.type === 'text' ? callResult.content[0].text : '{}')
    assert.equal(payload.ok, true)
    assert.match(payload.download.local_path, /bill\.csv$/)

    const text = await readFile(payload.download.local_path, 'utf8')
    assert.equal(text, 'a,b\n1,2\n')
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.OPENCLAW_ATTACHMENTS_ROOT
    await Promise.allSettled([
      client.close(),
      server.close(),
    ])
    await rm(root, { recursive: true, force: true })
  }
})
