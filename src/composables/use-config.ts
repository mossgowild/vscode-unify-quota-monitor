import { defineConfig } from 'reactive-vscode'
import type { AutoRefreshConfig, ProviderConfig } from '../types'

export interface Config {
  providers: ProviderConfig[]
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
