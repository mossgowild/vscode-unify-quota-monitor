export type ProviderId = 'zhipu' | 'zai' | 'google-antigravity' | 'github-copilot' | 'gemini-cli' | 'claude-code' | 'kimi-code'

export interface UsageCategory {
  name: string
  limitType: 'token' | 'request' | 'credit'
  used: number
  total: number
  percentageOnly?: boolean
  resetTime?: string
}

export interface ProviderAuth {
  required: boolean
  type: 'oauth' | 'key' | 'local'
  placeholder?: string
}

export interface ProviderDefinition {
  id: ProviderId
  name: string
  auth: ProviderAuth
}

export interface Provider extends ProviderDefinition {
  accounts: Account[]
}

export interface ConfigAccount {
  credential: string
  name?: string
}

export interface ProviderConfig {
  provider: ProviderId
  name?: string
  accounts: ConfigAccount[]
}

export interface Account {
  id: string
  alias?: string
  credential: string
  usage: UsageCategory[]
  lastUpdated: string
  error?: string
}

export interface AutoRefreshConfig {
  enabled: boolean
  intervalMs: number
}

export interface FetchUsageResult {
  success: boolean
  usage: UsageCategory[]
  error?: string
  lastUpdated: string
}
