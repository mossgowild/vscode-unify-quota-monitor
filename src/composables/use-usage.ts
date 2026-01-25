import { defineService, ref, watchEffect } from 'reactive-vscode'
import { window } from 'vscode'
import type { Account, Provider, ProviderId, StoredAccount, UsageCategory } from '../types'
import { getAllProviderDefinitions } from '../providers'
import { t } from '../i18n'
import { useAccounts } from './use-accounts'
import { config, DEFAULT_AUTO_REFRESH } from './use-config'
import { refreshGoogleToken, refreshOpenAIToken, getGitHubAccessToken } from '../utils/auth-helpers'

export const useUsage = defineService(() => {
  const { getAccountsByProvider } = useAccounts()

  const providers = ref<Provider[]>([])
  const isRefreshing = ref(false)
  const hasLoadedOnce = ref(false)

  function initProviders() {
    const definitions = getAllProviderDefinitions()
    providers.value = definitions.map(def => ({
      ...def,
      accounts: [],
    }))
  }

  async function getAccessToken(account: StoredAccount): Promise<string | null> {
    if (account.providerId === 'google') {
      try {
        const token = await refreshGoogleToken(account.credential)
        return token
      } catch {
        return null
      }
    }

    if (account.providerId === 'openai') {
      try {
        const json = JSON.parse(account.credential)
        if (json.accessToken) {
          return json.accessToken
        }
      } catch {
        return null
      }

      const result = await refreshOpenAIToken(account.credential)
      if (result) {
        return result.accessToken
      }
      return null
    }

    return account.credential
  }

  async function fetchGitHubUsage(account: StoredAccount): Promise<Account | null> {
    const githubToken = await getGitHubAccessToken()
    if (!githubToken) {
        return createErrorAccount(account, 'No GitHub token. Please re-login.')
    }

    try {
      // Use GitHub Token DIRECTLY for the user/quota endpoint
      // Do not exchange for Copilot token (tid=...) for this specific endpoint

      const response = await fetch('https://api.github.com/copilot_internal/user', {
        headers: {
          'Authorization': `token ${githubToken}`, 
          'User-Agent': 'GitHubCopilotChat/0.24.0',
          'Editor-Version': 'vscode/1.97.0',
          'Editor-Plugin-Version': 'copilot-chat/0.24.0',
          'Copilot-Integration-Id': 'vscode-chat',
          'X-GitHub-Api-Version': '2023-07-07'
        }
      })
      
      if (!response.ok) {
          return createErrorAccount(account, `API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json() as any
      const models: UsageCategory[] = []
      
      const interactions = data.quota_snapshots?.premium_interactions || data.premium_interactions || data.user_copilot?.premium_interactions
      
      if (interactions) {
        const limit = interactions.entitlement || interactions.limit || 0
        const remaining = interactions.remaining || 0
        const used = limit - remaining
        
        models.push({
          name: 'Premium Request',
          limitType: 'request',
          used: used,
          total: limit,
          resetTime: interactions.reset_date || interactions.next_reset_date
        })
      } else {
          const keys = Object.keys(data).join(', ')
          return createErrorAccount(account, `No usage data. Keys: ${keys}`)
      }
      
      return {
        id: account.id,
        alias: account.alias,
        credential: account.credential,
        usage: models,
        lastUpdated: new Date().toISOString(),
      }

    } catch (e: any) {
      return createErrorAccount(account, `Error: ${e.message || e}`)
    }
  }

  async function fetchOpenAIUsage(account: StoredAccount): Promise<Account | null> {
    const token = await getAccessToken(account)
    if (!token) return createErrorAccount(account)

    let response = await fetch('https://chatgpt.com/backend-api/wham/usage', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'UnifyQuotaMonitor/1.0',
      },
    })

    if (response.status === 401) {
      const result = await refreshOpenAIToken(account.credential)
      if (result?.accessToken) {
        response = await fetch('https://chatgpt.com/backend-api/wham/usage', {
          headers: {
            'Authorization': `Bearer ${result.accessToken}`,
            'User-Agent': 'UnifyQuotaMonitor/1.0',
          },
        })
      }
    }

    if (!response.ok) return createErrorAccount(account)

    const data = await response.json() as any
    const models: UsageCategory[] = []

    if (data.rate_limit) {
      const formatWindowName = (seconds: number) => {
        const hours = Math.round(seconds / 3600)
        return t('{hours}h Limit', { hours })
      }

      if (data.rate_limit.primary_window) {
        const w = data.rate_limit.primary_window
        models.push({
          name: formatWindowName(w.limit_window_seconds),
          limitType: 'request',
          used: w.used_percent,
          total: 100,
          percentageOnly: true,
          resetTime: new Date(Date.now() + w.reset_after_seconds * 1000).toISOString(),
        })
      }

      if (data.rate_limit.secondary_window) {
        const w = data.rate_limit.secondary_window
        models.push({
          name: formatWindowName(w.limit_window_seconds),
          limitType: 'request',
          used: w.used_percent,
          total: 100,
          percentageOnly: true,
          resetTime: new Date(Date.now() + w.reset_after_seconds * 1000).toISOString(),
        })
      }
    }

    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: models,
      lastUpdated: new Date().toISOString(),
    }
  }

  async function fetchZhipuUsage(
    providerId: 'zhipu' | 'zai',
    account: StoredAccount
  ): Promise<Account | null> {
    const apiKey = account.credential
    const url = providerId === 'zhipu'
      ? 'https://bigmodel.cn/api/monitor/usage/quota/limit'
      : 'https://api.z.ai/api/monitor/usage/quota/limit'

    const response = await fetch(url, {
      headers: {
        'Authorization': apiKey,
        'User-Agent': 'UnifyQuotaMonitor/1.0',
      },
    })

    if (!response.ok) return createErrorAccount(account)

    const data = await response.json() as any
    const models: UsageCategory[] = []

    if (data.success && data.data?.limits) {
      for (const l of data.data.limits) {
        let resetDate: Date | undefined
        const rawResetTime = l.nextResetTime || l.next_reset_time || l.resetTime || l.reset_time

        if (rawResetTime) {
          const timestamp = Number(rawResetTime)
          if (!Number.isNaN(timestamp) && timestamp > 0) {
            resetDate = new Date(timestamp)
          } else {
            resetDate = new Date(rawResetTime)
          }
        }

        models.push({
          name: l.type === 'TOKENS_LIMIT' ? t('Token Limit') : t('MCP Quota'),
          limitType: l.type === 'TOKENS_LIMIT' ? 'token' : 'request',
          used: l.currentValue,
          total: l.usage,
          resetTime: resetDate ? resetDate.toISOString() : undefined,
        })
      }

      // Sort: Token Limit first
      models.sort((a, b) => {
        if (a.limitType === 'token' && b.limitType !== 'token') return -1
        if (a.limitType !== 'token' && b.limitType === 'token') return 1
        return 0
      })
    }

    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: models,
      lastUpdated: new Date().toISOString(),
    }
  }

  async function fetchGoogleUsage(account: StoredAccount): Promise<Account | null> {
    const token = await getAccessToken(account)
    if (!token) return createErrorAccount(account)

    const quotaResponse = await fetch('https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'antigravity/1.11.9',
      },
      body: JSON.stringify({ project: 'rising-fact-p41fc' }),
    })

    if (!quotaResponse.ok) return createErrorAccount(account)

    const data = await quotaResponse.json() as any
    const models: UsageCategory[] = []
    const modelMap = new Map([
      ['claude-opus-4-5-thinking', 'Claude Opus 4.5'],
      ['gemini-3-pro-high', 'Gemini 3 Pro'],
      ['gemini-3-flash', 'Gemini 3 Flash'],
      ['gemini-3-pro-image', 'Gemini 3 Image'],
    ])

    for (const [key, label] of modelMap.entries()) {
      const m = data.models?.[key]
      if (m?.quotaInfo) {
        const remainingFraction = m.quotaInfo.remainingFraction ?? 0
        models.push({
          name: label,
          limitType: 'request',
          used: Math.round((1 - remainingFraction) * 100),
          total: 100,
          percentageOnly: true,
          resetTime: m.quotaInfo.resetTime,
        })
      }
    }

    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: models,
      lastUpdated: new Date().toISOString(),
    }
  }

  function createErrorAccount(account: StoredAccount, errorMessage?: string): Account {
    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: [],
      error: errorMessage || t('Failed to fetch usage'),
      lastUpdated: new Date().toISOString(),
    }
  }

  async function refreshProvider(providerId: ProviderId) {
    const provider = providers.value.find(p => p.id === providerId)
    if (!provider) return

    const storedAccounts = getAccountsByProvider(providerId)
    const newAccounts: Account[] = []

    const promises = storedAccounts.map(async (account) => {
      if (providerId === 'openai') {
        return fetchOpenAIUsage(account)
      } else if (providerId === 'google') {
        return fetchGoogleUsage(account)
      } else if (providerId === 'github') {
        return fetchGitHubUsage(account)
      } else {
        return fetchZhipuUsage(providerId as any, account)
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
      await window.withProgress({
        location: { viewId: 'unifyQuotaMonitor.usageView' },
        title: t('Refreshing usage...'),
      }, async () => {
        const promises = providers.value.map(p => refreshProvider(p.id))
        await Promise.allSettled(promises)
      })
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
    // Access config.accounts to track dependencies
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = config.accounts
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
    stopAutoRefresh,
  }
})
