/* eslint-disable @typescript-eslint/naming-convention */

export type ProviderId =
  | 'zhipu'
  | 'zai'
  | 'antigravity'
  | 'copilot'
  | 'gemini'
  | 'kimi'

export interface ConfigAccount {
  credential: string
  name?: string
}

export type ConfigProvider = Record<ProviderId, ConfigAccount[]>

// 扁平化配置类型（reactive-vscode defineConfig 需要）
export interface Config {
  providers: ConfigProvider
  autoRefreshEnabled: boolean
  autoRefreshIntervalMs: number
}

export interface UsageItem {
  name: string
  type: 'percentage' | 'quantity'
  used: number
  total?: number
  resetTime?: string
}

export interface ViewAccount {
  name: string
  usage: UsageItem[]
  error?: string
}

export interface ViewProvider {
  name: string
  accounts: ViewAccount[]
}
