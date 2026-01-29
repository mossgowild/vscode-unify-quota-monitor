import { defineService, ref, watchEffect } from 'reactive-vscode'
import { window } from 'vscode'
import type { Account, Provider, ProviderId, UsageCategory } from '../types'
import { getAllProviderDefinitions } from '../providers'
import { useAccounts } from './use-accounts'
import { useConfig, DEFAULT_AUTO_REFRESH } from './use-config'
import {
  refreshGoogleToken,
  getGitHubAccessToken,
  refreshGeminiCliToken
} from '../utils/key-helpers'
import { getClaudeCodeUsage } from '../utils/local-helpers'

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

  async function getAccessToken(
    account: Pick<Account, 'id' | 'credential'> & { providerId?: ProviderId }
  ): Promise<string | null> {
    if (account.providerId === 'google-antigravity') {
      try {
        const token = await refreshGoogleToken(account.credential)
        return token
      } catch {
        return null
      }
    }

    return account.credential
  }

  async function fetchGitHubUsage(
    account: Pick<Account, 'id' | 'alias' | 'credential'>
  ): Promise<Account | null> {
    const githubToken = await getGitHubAccessToken()
    if (!githubToken) {
      return createErrorAccount(account, 'No GitHub token. Please re-login.')
    }

    try {
      // Use GitHub Token DIRECTLY for the user/quota endpoint
      // Do not exchange for Copilot token (tid=...) for this specific endpoint

      const response = await fetch(
        'https://api.github.com/copilot_internal/user',
        {
          headers: {
            Authorization: `token ${githubToken}`,
            'User-Agent': 'GitHubCopilotChat/0.24.0',
            'Editor-Version': 'vscode/1.97.0',
            'Editor-Plugin-Version': 'copilot-chat/0.24.0',
            'Copilot-Integration-Id': 'vscode-chat',
            'X-GitHub-Api-Version': '2023-07-07'
          }
        }
      )

      if (!response.ok) {
        return createErrorAccount(
          account,
          `API Error: ${response.status} ${response.statusText}`
        )
      }

      const data = (await response.json()) as any
      const models: UsageCategory[] = []

      const interactions =
        data.quota_snapshots?.premium_interactions ||
        data.premium_interactions ||
        data.user_copilot?.premium_interactions

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
        lastUpdated: new Date().toISOString()
      }
    } catch (e: any) {
      return createErrorAccount(account, `Error: ${e.message || e}`)
    }
  }

  async function fetchZhipuUsage(
    providerId: 'zhipu' | 'zai',
    account: Pick<Account, 'id' | 'alias' | 'credential'>
  ): Promise<Account | null> {
    const apiKey = account.credential
    const url =
      providerId === 'zhipu'
        ? 'https://bigmodel.cn/api/monitor/usage/quota/limit'
        : 'https://api.z.ai/api/monitor/usage/quota/limit'

    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
        'User-Agent': 'UnifyQuotaMonitor/1.0'
      }
    })

    if (!response.ok) return createErrorAccount(account)

    const data = (await response.json()) as any
    const models: UsageCategory[] = []

    if (data.success && data.data?.limits) {
      for (const l of data.data.limits) {
        let resetDate: Date | undefined
        const rawResetTime =
          l.nextResetTime || l.next_reset_time || l.resetTime || l.reset_time

        if (rawResetTime) {
          const timestamp = Number(rawResetTime)
          if (!Number.isNaN(timestamp) && timestamp > 0) {
            resetDate = new Date(timestamp)
          } else {
            resetDate = new Date(rawResetTime)
          }
        }

        models.push({
          name: l.type === 'TOKENS_LIMIT' ? 'Token Limit' : 'MCP Quota',
          limitType: l.type === 'TOKENS_LIMIT' ? 'token' : 'request',
          used: l.currentValue,
          total: l.usage,
          resetTime: resetDate ? resetDate.toISOString() : undefined
        })
      }

      // Sort: Token Limit first, then by usage percentage (ascending)
      models.sort((a, b) => {
        if (a.limitType === 'token' && b.limitType !== 'token') return -1
        if (a.limitType !== 'token' && b.limitType === 'token') return 1
        
        const pA = a.total > 0 ? (a.used / a.total) : 0
        const pB = b.total > 0 ? (b.used / b.total) : 0
        return pA - pB
      })
    }

    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: models,
      lastUpdated: new Date().toISOString()
    }
  }

  async function fetchGoogleUsage(
    account: Pick<Account, 'id' | 'alias' | 'credential'> & { providerId?: ProviderId }
  ): Promise<Account | null> {
    const token = await getAccessToken(account)
    if (!token) return createErrorAccount(account)

    const quotaResponse = await fetch(
      'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'antigravity/1.11.9'
        },
        body: JSON.stringify({ project: 'rising-fact-p41fc' })
      }
    )

    if (!quotaResponse.ok) return createErrorAccount(account)

    const data = (await quotaResponse.json()) as any
    const models: UsageCategory[] = []
    const modelMap = new Map([
      ['claude-opus-4-5-thinking', 'Claude Opus 4.5'],
      ['gemini-3-pro-high', 'Gemini 3 Pro'],
      ['gemini-3-flash', 'Gemini 3 Flash'],
      ['gemini-3-pro-image', 'Gemini 3 Image']
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
          resetTime: m.quotaInfo.resetTime
        })
      }
    }

    // Sort by usage percentage (ascending - more remaining first)
    models.sort((a, b) => {
      const pA = a.total > 0 ? (a.used / a.total) : 0
      const pB = b.total > 0 ? (b.used / b.total) : 0
      return pA - pB
    })

    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: models,
      lastUpdated: new Date().toISOString()
    }
  }

  async function fetchClaudeCodeUsage(
    account: Pick<Account, 'id' | 'alias' | 'credential'>
  ): Promise<Account | null> {
    const result = await getClaudeCodeUsage()

    if (!result.isInstalled) {
      return createErrorAccount(account, result.error || 'Claude Code not installed')
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

  async function fetchGeminiCliUsage(
    account: Pick<Account, 'id' | 'alias' | 'credential'>
  ): Promise<Account | null> {
    let credentialData: { accessToken?: string; refreshToken?: string }
    try {
      credentialData = JSON.parse(account.credential) as {
        accessToken?: string
        refreshToken?: string
      }
    } catch {
      return createErrorAccount(account, 'Invalid credential format')
    }

    let accessToken = credentialData.accessToken || ''

    // Try to refresh token if no access token
    if (!accessToken && credentialData.refreshToken) {
      const result = await refreshGeminiCliToken(account.credential)
      if (result) {
        accessToken = result.accessToken
        // Update stored credential with new access token
        await updateCredential(account.id, result.newCredential)
        credentialData = JSON.parse(result.newCredential) as {
          accessToken?: string
          refreshToken?: string
        }
      }
    }

    if (!accessToken) {
      return createErrorAccount(account, 'No valid access token')
    }

    // Helper to make API calls with retry on 401
    async function makeRequest<T>(
      url: string,
      body: object
    ): Promise<T | null> {
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'gemini-cli/1.0'
        },
        body: JSON.stringify(body)
      })

      // Retry once with refreshed token on 401
      if (response.status === 401 && credentialData.refreshToken) {
        const result = await refreshGeminiCliToken(account.credential)
        if (result) {
          accessToken = result.accessToken
          // Update stored credential
          await updateCredential(account.id, result.newCredential)
          credentialData = JSON.parse(result.newCredential) as {
            accessToken?: string
            refreshToken?: string
          }

          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
              'User-Agent': 'gemini-cli/1.0'
            },
            body: JSON.stringify(body)
          })
        }
      }

      if (!response.ok) {
        return null
      }

      return response.json() as Promise<T>
    }

    // Step 1: Get project ID
    const loadCodeAssistUrl =
      'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist'
    const loadCodeAssistBody = {
      metadata: {
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI'
      }
    }

    interface LoadCodeAssistResponse {
      cloudaicompanionProject?: string
    }

    const loadResult = await makeRequest<LoadCodeAssistResponse>(
      loadCodeAssistUrl,
      loadCodeAssistBody
    )
    if (!loadResult?.cloudaicompanionProject) {
      return createErrorAccount(account, 'Failed to load project')
    }

    const projectId = loadResult.cloudaicompanionProject

    // Step 2: Get quota
    const quotaUrl =
      'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota'
    const quotaBody = { project: projectId }

    interface QuotaBucket {
      modelId: string
      remainingFraction: number
      resetTime?: string
    }

    interface QuotaResponse {
      buckets?: QuotaBucket[]
    }

    const quotaResult = await makeRequest<QuotaResponse>(quotaUrl, quotaBody)
    if (!quotaResult?.buckets) {
      return createErrorAccount(account, 'Failed to fetch quota')
    }

    // Map buckets to usage categories
    const modelMap = new Map([
      // Gemini 3 series (Preview)
      ['gemini-3-pro-preview', 'Gemini 3 Pro'],
      ['gemini-3-pro', 'Gemini 3 Pro'],
      ['gemini-3-flash-preview', 'Gemini 3 Flash'],
      ['gemini-3-flash', 'Gemini 3 Flash'],
      ['gemini-3-image', 'Gemini 3 Image'],
      // Gemini 2.5 series
      ['gemini-2.5-pro', 'Gemini 2.5 Pro'],
      ['gemini-2.5-pro-thinking', 'Gemini 2.5 Pro Thinking'],
      ['gemini-2.5-flash', 'Gemini 2.5 Flash'],
      ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite'],
      // Gemini 2.0 series
      ['gemini-2.0-flash', 'Gemini 2.0 Flash'],
      ['gemini-2.0-flash-thinking', 'Gemini 2.0 Flash Thinking'],
      ['gemini-2.0-flash-lite', 'Gemini 2.0 Flash Lite'],
      ['gemini-2.0-pro', 'Gemini 2.0 Pro'],
      // Gemini 1.5 series
      ['gemini-1.5-pro', 'Gemini 1.5 Pro'],
      ['gemini-1.5-flash', 'Gemini 1.5 Flash'],
      // Legacy models
      ['gemini-pro', 'Gemini Pro'],
      ['gemini-ultra', 'Gemini Ultra'],
      // Experimental/Preview models
      ['gemini-exp-1206', 'Gemini Experimental'],
      ['gemini-2.0-flash-exp', 'Gemini 2.0 Flash Exp'],
      // Generic fallbacks
      ['gemini', 'Gemini']
    ])

    const models: UsageCategory[] = []
    for (const bucket of quotaResult.buckets) {
      const label = modelMap.get(bucket.modelId) || bucket.modelId
      models.push({
        name: label,
        limitType: 'request',
        used: Math.round((1 - bucket.remainingFraction) * 100),
        total: 100,
        percentageOnly: true,
        resetTime: bucket.resetTime
      })
    }
    
    // Sort by usage percentage (ascending - more remaining first)
    models.sort((a, b) => {
      const pA = a.total > 0 ? (a.used / a.total) : 0
      const pB = b.total > 0 ? (b.used / b.total) : 0
      return pA - pB
    })

    return {
      id: account.id,
      alias: account.alias,
      credential: account.credential,
      usage: models,
      lastUpdated: new Date().toISOString()
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
      error: errorMessage || 'Failed to fetch usage',
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
        return fetchGeminiCliUsage(account)
      } else if (providerId === 'claude-code') {
        return fetchClaudeCodeUsage(account)
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
      await window.withProgress(
        {
          location: { viewId: 'unifyQuotaMonitor.usageView' },
          title: 'Refreshing usage...'
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
