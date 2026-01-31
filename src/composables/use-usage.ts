import { defineService, ref, watchEffect } from 'reactive-vscode'
import { window } from 'vscode'
import type { Account, Provider, ProviderId, UsageCategory } from '../types'
import { getAllProviderDefinitions } from '../providers'
import { useAccounts } from './use-accounts'
import { useConfig, DEFAULT_AUTO_REFRESH } from './use-config'
import { fetchGitHubCopilotUsage } from '../utils/usage/github'
import { fetchZhipuUsage } from '../utils/usage/zhipu'
import { fetchGoogleAntigravityUsage } from '../utils/usage/google'
import { fetchGeminiCliUsage } from '../utils/usage/gemini'
import { getClaudeCodeUsage } from '../utils/usage/claude'
import { fetchKimiCodeUsage } from '../utils/usage/kimi'
import { ERROR_MESSAGES, UI_MESSAGES } from '../constants'

export const useUsage = defineService(() => {
  const { getAccountsByProvider, updateCredential } = useAccounts()
  const config = useConfig()
  const providers = ref<Provider[]>([])
  const isRefreshing = ref(false)
  const hasLoadedOnce = ref(false)

  function initProviders() {
    const definitions = getAllProviderDefinitions()
    providers.value = definitions.map((def) => ({
      ...def,
      accounts: []
    }))
  }

  async function fetchGitHubUsage(
    account: Pick<Account, 'id' | 'alias' | 'credential'>
  ): Promise<Account | null> {
    const result = await fetchGitHubCopilotUsage()
    if (!result.success) {
      return createErrorAccount(account, result.error)
    }
    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: result.usage,
      lastUpdated: result.lastUpdated
    }
  }

  async function fetchZhipuUsageWrapper(
    providerId: 'zhipu' | 'zai',
    account: Pick<Account, 'id' | 'alias' | 'credential'>
  ): Promise<Account | null> {
    const result = await fetchZhipuUsage(providerId, account.credential)
    if (!result.success) {
      return createErrorAccount(account, result.error)
    }
    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: result.usage,
      lastUpdated: result.lastUpdated
    }
  }

  async function fetchGoogleUsage(
    account: Pick<Account, 'id' | 'alias' | 'credential'>
  ): Promise<Account | null> {
    const result = await fetchGoogleAntigravityUsage(
      account.credential,
      async (newToken) => {
        await updateCredential(account.id, newToken)
      }
    )
    if (!result.success) {
      return createErrorAccount(account, result.error)
    }
    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: result.usage,
      lastUpdated: result.lastUpdated
    }
  }

  async function fetchClaudeCodeUsage(
    account: Pick<Account, 'id' | 'alias' | 'credential'>
  ): Promise<Account | null> {
    const result = await getClaudeCodeUsage()

    if (!result.isInstalled) {
      return createErrorAccount(account, result.error || ERROR_MESSAGES.CLAUDE.NOT_INSTALLED)
    }

    const models: UsageCategory[] = [{
      name: '5-Hour Window',
      limitType: 'credit',
      used: Math.round(result.costUSD * 100) / 100,
      total: 5.0,
      percentageOnly: false,
      resetTime: result.resetTime?.toISOString()
    }]

    // If no usage data yet, show info but not as error
    if (!result.hasUsageData) {
      return {
        id: account.id,
        alias: account.alias,
        credential: account.credential,
        usage: models,
        lastUpdated: new Date().toISOString()
      }
    }

    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: models,
      lastUpdated: new Date().toISOString()
    }
  }

  async function fetchGeminiCliUsageWrapper(
    account: Pick<Account, 'id' | 'alias' | 'credential'>
  ): Promise<Account | null> {
    const result = await fetchGeminiCliUsage(
      account.credential,
      async (newCredential: string) => {
        await updateCredential(account.id, newCredential)
      }
    )
    if (!result.success) {
      return createErrorAccount(account, result.error)
    }
    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: result.usage,
      lastUpdated: result.lastUpdated
    }
  }

  async function fetchKimiCodeUsageWrapper(
    account: Pick<Account, 'id' | 'alias' | 'credential'>
  ): Promise<Account | null> {
    const result = await fetchKimiCodeUsage(account.credential)
    if (!result.success) {
      return createErrorAccount(account, result.error)
    }
    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: result.usage,
      lastUpdated: result.lastUpdated
    }
  }

  function createErrorAccount(
    account: Pick<Account, 'id' | 'alias' | 'credential'>,
    errorMessage?: string
  ): Account {
    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: [],
      error: errorMessage || ERROR_MESSAGES.API.UNKNOWN('Failed to fetch usage'),
      lastUpdated: new Date().toISOString()
    }
  }

  async function refreshProvider(providerId: ProviderId) {
    const provider = providers.value.find((p) => p.id === providerId)
    if (!provider) return

    const storedAccounts = getAccountsByProvider(providerId)
    const newAccounts: Account[] = []

    const promises = storedAccounts.map(async (account) => {
      if (providerId === 'google-antigravity') {
        return fetchGoogleUsage(account)
      } else if (providerId === 'github-copilot') {
        return fetchGitHubUsage(account)
      } else if (providerId === 'gemini-cli') {
        return fetchGeminiCliUsageWrapper(account)
      } else if (providerId === 'claude-code') {
        return fetchClaudeCodeUsage(account)
      } else if (providerId === 'kimi-code') {
        return fetchKimiCodeUsageWrapper(account)
      } else {
        return fetchZhipuUsageWrapper(providerId as 'zhipu' | 'zai', account)
      }
    })

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        newAccounts.push(result.value)
      }
    }

    provider.accounts = newAccounts
  }

  async function refreshAll() {
    isRefreshing.value = true
    try {
      await window.withProgress(
        {
          location: { viewId: 'unifyQuotaMonitor.usageView' },
          title: UI_MESSAGES.REFRESHING
        },
        async () => {
          const promises = providers.value.map((p) => refreshProvider(p.id))
          await Promise.allSettled(promises)
        }
      )
    } finally {
      isRefreshing.value = false
      hasLoadedOnce.value = true
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  function debouncedRefresh() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      refreshAll()
    }, 300)
  }

  watchEffect(() => {
    // Access config.providers to track dependencies
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = config.providers
    debouncedRefresh()
  })

  let refreshTimer: ReturnType<typeof setInterval> | undefined

  function startAutoRefresh() {
    stopAutoRefresh()
    const autoRefresh = config.autoRefresh ?? DEFAULT_AUTO_REFRESH
    if (autoRefresh.enabled) {
      refreshTimer = setInterval(() => {
        refreshAll()
      }, autoRefresh.intervalMs)
    }
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = undefined
    }
  }

  watchEffect(() => {
    const autoRefresh = config.autoRefresh
    stopAutoRefresh()
    if (autoRefresh?.enabled) {
      refreshTimer = setInterval(() => {
        refreshAll()
      }, autoRefresh.intervalMs)
    }
  })

  initProviders()

  return {
    providers,
    isRefreshing,
    hasLoadedOnce,
    refresh: refreshAll,
    startAutoRefresh,
    stopAutoRefresh
  }
})
