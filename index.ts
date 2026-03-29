import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { pathToFileURL } from 'node:url'
import { getPluginConfig, OPENCLAW_PLUGIN_ID, resolveRuntimeConfig } from './src/config.js'
import { registerMessageAttachmentDownloadTool, registerOpenClawMessageAttachmentDownloadTool } from './src/tools/message-attachment-download.js'

type OpenClawPluginApi = {
  config?: unknown
  registerTool?: (tool: {
    name: string
    description: string
    parameters: object
    execute(id: string, params: unknown): Promise<unknown>
  }) => void
}

export function getRuntimeConfigFromApiConfig(apiConfig: unknown) {
  return resolveRuntimeConfig(getPluginConfig(apiConfig))
}

export const plugin = {
  id: OPENCLAW_PLUGIN_ID,
  name: 'openclaw-message-attachments',
  register(api: OpenClawPluginApi) {
    if (!api.registerTool) {
      throw new Error('OpenClaw plugin API does not expose registerTool.')
    }

    registerOpenClawMessageAttachmentDownloadTool(
      api as Required<Pick<OpenClawPluginApi, 'registerTool'>>,
      getRuntimeConfigFromApiConfig(api.config),
    )
  },
}

export default plugin

function isExecutedDirectly(): boolean {
  return Boolean(process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
}

async function main(): Promise<void> {
  const server = new McpServer({
    name: 'openclaw-message-attachments',
    version: '0.1.0',
  })

  const openClawConfig = Reflect.get(globalThis, '__OPENCLAW_CONFIG__')
  const runtimeConfig = getRuntimeConfigFromApiConfig(openClawConfig)

  registerMessageAttachmentDownloadTool(server, runtimeConfig)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

if (isExecutedDirectly()) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
