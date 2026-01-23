import { defineConfig } from 'reactive-vscode'
import type { AutoRefreshConfig, StoredAccount } from '../types'

export interface Config {
  accounts: StoredAccount[]
  autoRefresh: AutoRefreshConfig
}

export const config = defineConfig<Config>('unifyQuotaMonitor')

// 默认值
export const DEFAULT_AUTO_REFRESH: AutoRefreshConfig = {
  enabled: true,
  intervalMs: 60000,
}
