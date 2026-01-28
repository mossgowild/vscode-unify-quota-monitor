import { defineConfig } from 'reactive-vscode'
import type { AutoRefreshConfig, StoredAccount } from '../types'

export interface Config {
  accounts: StoredAccount[]
  autoRefresh: AutoRefreshConfig
}

const config = defineConfig<Config>('unifyQuotaMonitor')

export function useConfig() {
  return config
}

// 默认值
export const DEFAULT_AUTO_REFRESH: AutoRefreshConfig = {
  enabled: true,
  intervalMs: 180000
}
