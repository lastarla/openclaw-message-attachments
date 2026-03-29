export const OPENCLAW_PLUGIN_ID = '@angli/openclaw-message-attachments'

export type PluginConfig = {
  sources?: {
    feishu?: {
      appToken?: string
      openApiBase?: string
    }
    [key: string]: unknown
  }
  download?: {
    maxBytes?: number
  }
}

export type FeishuAdapterConfig = {
  appToken?: string
  openApiBase: string
  maxBytes: number
}

export type ResolvedRuntimeConfig = {
  sources: {
    feishu: FeishuAdapterConfig
  }
  download: {
    maxBytes: number
  }
}

const DEFAULT_FEISHU_OPEN_API_BASE = 'https://open.feishu.cn/open-apis'
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readPositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return undefined
}

function isPluginConfigShape(value: unknown): value is PluginConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  return Reflect.has(value, 'sources') || Reflect.has(value, 'download')
}

export function getPluginConfigFromOpenClawConfig(openClawConfig: unknown, pluginId = OPENCLAW_PLUGIN_ID): PluginConfig {
  if (!openClawConfig || typeof openClawConfig !== 'object') {
    return {}
  }

  const plugins = Reflect.get(openClawConfig, 'plugins')
  if (!plugins || typeof plugins !== 'object') {
    return {}
  }

  const entries = Reflect.get(plugins, 'entries')
  if (!entries || typeof entries !== 'object') {
    return {}
  }

  const pluginEntry = Reflect.get(entries, pluginId)
  if (!pluginEntry || typeof pluginEntry !== 'object') {
    return {}
  }

  const config = Reflect.get(pluginEntry, 'config')
  if (!config || typeof config !== 'object') {
    return {}
  }

  return config as PluginConfig
}

export function getPluginConfig(input: unknown, pluginId = OPENCLAW_PLUGIN_ID): PluginConfig {
  if (isPluginConfigShape(input)) {
    return input
  }

  return getPluginConfigFromOpenClawConfig(input, pluginId)
}

export function resolveRuntimeConfig(pluginConfig: PluginConfig = {}, env: NodeJS.ProcessEnv = process.env): ResolvedRuntimeConfig {
  const pluginFeishu = pluginConfig.sources?.feishu
  const pluginDownload = pluginConfig.download

  const maxBytes = readPositiveNumber(pluginDownload?.maxBytes)
    ?? readPositiveNumber(env.OPENCLAW_ATTACHMENT_MAX_BYTES)
    ?? DEFAULT_MAX_BYTES

  return {
    sources: {
      feishu: {
        appToken: readNonEmptyString(pluginFeishu?.appToken) ?? readNonEmptyString(env.FEISHU_APP_TOKEN),
        openApiBase: readNonEmptyString(pluginFeishu?.openApiBase)
          ?? readNonEmptyString(env.FEISHU_OPEN_API_BASE)
          ?? DEFAULT_FEISHU_OPEN_API_BASE,
        maxBytes,
      },
    },
    download: {
      maxBytes,
    },
  }
}
