import { defineConfig } from 'reactive-vscode'
import type { Config } from '../types'

const config = defineConfig<Config>('unifyQuotaMonitor', null)

export function useConfig() {
  return config
}
