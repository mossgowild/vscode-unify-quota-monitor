import { defineExtension, defineLogger, useCommand } from 'reactive-vscode'
import { useAuth } from './composables/use-auth'
import { useUsage, injectTokenRefreshers } from './composables/use-usage'
import { useView } from './composables/use-view'

const logger = defineLogger('Unify Quota Monitor')

export = defineExtension(() => {
  logger.info('Extension Activated')

  const auth = useAuth()
  injectTokenRefreshers(auth.refreshGoogleToken, auth.refreshOpenAIToken)

  const usage = useUsage()
  useView()

  useCommand('unifyQuotaMonitor.manageAccounts', () => auth.showAccountMenu())
  useCommand('unifyQuotaMonitor.refresh', () => usage.refresh())

  usage.startAutoRefresh()
  usage.refresh()

  return () => {
    usage.stopAutoRefresh()
    logger.info('Extension Deactivated')
  }
})
