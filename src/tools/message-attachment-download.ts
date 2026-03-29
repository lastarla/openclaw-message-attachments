import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { FeishuAttachmentAdapter } from '../adapters/feishu.js'
import { failure } from '../errors.js'
import type { AttachmentAdapterRegistry, DownloadRequest, DownloadResult, RuntimeConfig } from '../types.js'

const attachmentSchema = z.object({
  source: z.enum(['feishu']),
  id: z.string().min(1),
  name: z.string().min(1),
  source_message_id: z.string().min(1),
  mime_type: z.string().optional(),
  size: z.number().nonnegative().optional(),
})

const messageSchema = z.object({
  message_id: z.string().optional(),
  chat_id: z.string().optional(),
}).optional()

export const downloadRequestSchema = z.object({
  attachment: attachmentSchema,
  message: messageSchema,
  purpose: z.string().optional(),
})

export const openClawToolParameters = {
  type: 'object',
  properties: {
    attachment: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['feishu'] },
        id: { type: 'string' },
        name: { type: 'string' },
        source_message_id: { type: 'string' },
        mime_type: { type: 'string' },
        size: { type: 'number' },
      },
      required: ['source', 'id', 'name', 'source_message_id'],
      additionalProperties: false,
    },
    message: {
      type: 'object',
      properties: {
        message_id: { type: 'string' },
        chat_id: { type: 'string' },
      },
      additionalProperties: false,
    },
    purpose: { type: 'string' },
  },
  required: ['attachment'],
  additionalProperties: false,
} as const

type OpenClawToolApi = {
  registerTool(tool: {
    name: string
    description: string
    parameters: typeof openClawToolParameters
    execute(id: string, params: unknown): Promise<DownloadResult>
  }): void
}

function createAdapterRegistry(config: RuntimeConfig): AttachmentAdapterRegistry {
  return {
    feishu: new FeishuAttachmentAdapter(config.sources.feishu),
  }
}

function resultToToolContent(result: DownloadResult) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
    isError: !result.ok,
  }
}

async function handleDownload(input: DownloadRequest, adapters: AttachmentAdapterRegistry): Promise<DownloadResult> {
  switch (input.attachment.source) {
    case 'feishu':
      return adapters.feishu.download(input)
    default:
      return failure('unsupported_source', `Source '${input.attachment.source}' is not supported in v1.`)
  }
}

export function createMessageAttachmentDownloadHandler(config: RuntimeConfig) {
  const adapters = createAdapterRegistry(config)

  return async (input: DownloadRequest): Promise<DownloadResult> => {
    return handleDownload(input, adapters)
  }
}

export function registerMessageAttachmentDownloadTool(server: McpServer, config: RuntimeConfig): void {
  const handle = createMessageAttachmentDownloadHandler(config)

  server.registerTool(
    'message_attachment_download',
    {
      description: 'Download a referenced message attachment to a local file and return the local path.',
      inputSchema: downloadRequestSchema,
    },
    async (input) => {
      const result = await handle(input)
      return resultToToolContent(result)
    },
  )
}

export function registerOpenClawMessageAttachmentDownloadTool(api: OpenClawToolApi, config: RuntimeConfig): void {
  const handle = createMessageAttachmentDownloadHandler(config)

  api.registerTool({
    name: 'message_attachment_download',
    description: 'Download a referenced message attachment to a local file and return the local path.',
    parameters: openClawToolParameters,
    async execute(_id, params) {
      const parsed = downloadRequestSchema.safeParse(params)
      if (!parsed.success) {
        return failure('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid tool arguments.')
      }

      return handle(parsed.data)
    },
  })
}
