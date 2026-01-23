import { defineService, ref, watch } from 'reactive-vscode'
import { window } from 'vscode'
import type { Account, Provider, ProviderId, StoredAccount, UsageCategory } from '../types'
import { getAllProviderDefinitions } from '../providers'
import { t } from '../i18n'
import { useAccounts } from './use-accounts'
import { config, DEFAULT_AUTO_REFRESH } from './use-config'

// Token 刷新函数类型
type RefreshGoogleTokenFn = (refreshToken: string) => Promise<string>
type RefreshOpenAITokenFn = (account: StoredAccount) => Promise<string | null>

// 延迟注入的刷新函数
let _refreshGoogleToken: RefreshGoogleTokenFn | null = null
let _refreshOpenAIToken: RefreshOpenAITokenFn | null = null

export function injectTokenRefreshers(
  refreshGoogleToken: RefreshGoogleTokenFn,
  refreshOpenAIToken: RefreshOpenAITokenFn,
) {
  _refreshGoogleToken = refreshGoogleToken
  _refreshOpenAIToken = refreshOpenAIToken
}

export const useUsage = defineService(() => {
  const providers = ref<Provider[]>([])
  const isRefreshing = ref(false)
  const hasLoadedOnce = ref(false)

  // 初始化 Provider 定义
  function initProviders() {
    const definitions = getAllProviderDefinitions()
    providers.value = definitions.map(def => ({
      ...def,
      accounts: [],
    }))
  }

  const { getAccountsByProvider } = useAccounts()

  async function fetchOpenAIUsage(account: StoredAccount): Promise<UsageCategory[]> {
    let token = account.credential

    try {
      const json = JSON.parse(account.credential) as { accessToken?: string }
      if (json.accessToken) {
        token = json.accessToken
      }
    }
    catch {
      // Not a JSON, treat as raw token
    }

    let response = await fetch('https://chatgpt.com/backend-api/wham/usage', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'UnifyQuotaMonitor/1.0',
      },
    })

    // 尝试刷新 Token
    if (response.status === 401 && _refreshOpenAIToken) {
      const newToken = await _refreshOpenAIToken(account)
      if (newToken) {
        response = await fetch('https://chatgpt.com/backend-api/wham/usage', {
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'User-Agent': 'UnifyQuotaMonitor/1.0',
          },
        })
      }
    }

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

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

    return models
  }

  async function fetchZhipuUsage(providerId: 'zhipu' | 'zai', token: string): Promise<UsageCategory[]> {
    const url = providerId === 'zhipu'
      ? 'https://bigmodel.cn/api/monitor/usage/quota/limit'
      : 'https://api.z.ai/api/monitor/usage/quota/limit'

    const response = await fetch(url, {
      headers: {
        'Authorization': token,
        'User-Agent': 'UnifyQuotaMonitor/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`${providerId} API error: ${response.status}`)
    }

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
          }
          else {
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
    }

    return models
  }

  async function fetchGoogleUsage(refreshToken: string): Promise<UsageCategory[]> {
    if (!_refreshGoogleToken) {
      throw new Error('Google token refresher not injected')
    }

    const accessToken = await _refreshGoogleToken(refreshToken)

    const quotaResponse = await fetch('https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'antigravity/1.11.9',
      },
      body: JSON.stringify({ project: 'rising-fact-p41fc' }),
    })

    if (!quotaResponse.ok) {
      throw new Error(`Google API error: ${quotaResponse.status}`)
    }

    const data = await quotaResponse.json() as any
    const models: UsageCategory[] = []
    const modelMap = new Map([
      ['gemini-3-pro-high', 'Gemini 3 Pro'],
      ['gemini-3-flash', 'Gemini 3 Flash'],
      ['gemini-3-pro-image', 'Gemini 3 Image'],
      ['claude-opus-4-5-thinking', 'Claude Opus'],
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

    return models
  }

  async function fetchAccountUsage(providerId: ProviderId, storedAccount: StoredAccount): Promise<Account | null> {
    try {
      let usage: UsageCategory[] = []

      if (providerId === 'openai') {
        usage = await fetchOpenAIUsage(storedAccount)
      }
      else if (providerId === 'zhipu' || providerId === 'zai') {
        usage = await fetchZhipuUsage(providerId, storedAccount.credential)
      }
      else if (providerId === 'google') {
        usage = await fetchGoogleUsage(storedAccount.credential)
      }

      return {
        id: storedAccount.id,
        alias: storedAccount.alias,
        credential: storedAccount.credential,
        usage,
        lastUpdated: new Date().toISOString(),
      }
    }
    catch (err) {
      console.error(`Failed to fetch usage for account ${storedAccount.id}:`, err)
      return {
        id: storedAccount.id,
        alias: storedAccount.alias,
        credential: storedAccount.credential,
        usage: [],
        lastUpdated: new Date().toISOString(),
      }
    }
  }

  async function refreshProvider(providerId: ProviderId) {
    const provider = providers.value.find(p => p.id === providerId)
    if (!provider) {
      return
    }

    const storedAccounts = getAccountsByProvider(providerId)
    const newAccounts: Account[] = []

    const promises = storedAccounts.map(stored => fetchAccountUsage(providerId, stored))
    const results = await Promise.allSettled(promises)

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        newAccounts.push(result.value)
      }
    }

    provider.accounts = newAccounts
  }

  async function refresh(providerId?: ProviderId) {
    if (isRefreshing.value) {
      return
    }

    isRefreshing.value = true

    try {
      await window.withProgress({
        location: { viewId: 'unifyQuotaMonitor.usageView' },
        title: t('Refreshing usage...'),
      }, async () => {
        if (providerId) {
          await refreshProvider(providerId)
        }
        else {
          const promises = providers.value.map(p => refreshProvider(p.id))
          await Promise.allSettled(promises)
        }
      })
    }
    finally {
      isRefreshing.value = false
      hasLoadedOnce.value = true
    }
  }

  function hasStoredAccounts(): boolean {
    return providers.value.some(p => getAccountsByProvider(p.id).length > 0)
  }

  // 自动刷新
  let refreshTimer: ReturnType<typeof setInterval> | undefined

  function getAutoRefreshConfig() {
    return config.autoRefresh ?? DEFAULT_AUTO_REFRESH
  }

  function startAutoRefresh() {
    stopAutoRefresh()
    const autoRefresh = getAutoRefreshConfig()
    if (autoRefresh.enabled) {
      refreshTimer = setInterval(() => {
        refresh()
      }, autoRefresh.intervalMs)
    }
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = undefined
    }
  }

  // 初始化
  initProviders()

  // 监听 autoRefresh 配置变化，重新启动自动刷新
  watch(
    () => ({ ...getAutoRefreshConfig() }),
    () => {
      const autoRefresh = getAutoRefreshConfig()
      if (autoRefresh.enabled) {
        startAutoRefresh()
      }
      else {
        stopAutoRefresh()
      }
    },
    { deep: true, immediate: true },
  )

  // 监听账号配置变化，自动刷新用量
  watch(
    () => config.accounts,
    () => {
      refresh()
    },
    { deep: true },
  )

  return {
    providers,
    isRefreshing,
    hasLoadedOnce,
    refresh,
    hasStoredAccounts,
    startAutoRefresh,
    stopAutoRefresh,
  }
})
