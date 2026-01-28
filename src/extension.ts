import { defineExtension, defineLogger, useCommand } from 'reactive-vscode'
import { useConfig } from './composables/use-config'
import { useAccounts } from './composables/use-accounts'
import { useUsage } from './composables/use-usage'
import { useView } from './composables/use-view'

const logger = defineLogger('Unify Quota Monitor')

export = defineExtension(() => {
  logger.info('Extension Activated')

  useConfig()
  useAccounts()
  const usage = useUsage()
  const view = useView()

  useCommand('unifyQuotaMonitor.settings', () => view.showAccountMenu())
  useCommand('unifyQuotaMonitor.refresh', () => usage.refresh())

  usage.startAutoRefresh()
  usage.refresh()

  return () => {
    usage.stopAutoRefresh()
    logger.info('Extension Deactivated')
  }
})
