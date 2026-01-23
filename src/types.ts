export type ProviderId = 'openai' | 'zhipu' | 'zai' | 'google'

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
  type: 'token' | 'oauth' | 'key'
  placeholder?: string
  helpUrl?: string
}

export interface ProviderDefinition {
  id: ProviderId
  name: string
  icon: string
  auth: ProviderAuth
}

export interface Provider extends ProviderDefinition {
  accounts: Account[]
}

export interface StoredAccount {
  id: string
  providerId: ProviderId
  alias?: string
  credential: string
}

export interface Account {
  id: string
  alias?: string
  credential: string
  usage: UsageCategory[]
  lastUpdated: string
}

export interface AutoRefreshConfig {
  enabled: boolean
  intervalMs: number
}
