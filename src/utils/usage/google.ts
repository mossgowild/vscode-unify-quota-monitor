/* eslint-disable @typescript-eslint/naming-convention */
import type { FetchUsageResult, UsageCategory } from '../../types'
import { refreshAntigravityToken } from '../auth/antigravity'
import { ERROR_MESSAGES } from '../../constants'
import { formatModelName } from './format-model-name'

export async function fetchGoogleAntigravityUsage(
  refreshToken: string
): Promise<FetchUsageResult> {
  try {
    // Google OAuth: refresh_token is long-lived, access_token is short-lived (1 hour).
    // We only store refresh_token, and exchange it for a new access_token on each API call.
    // Do NOT save access_token - it will overwrite the refresh_token and break future refreshes.
    const token = await refreshAntigravityToken(refreshToken)

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

    if (!quotaResponse.ok) {
      return {
        success: false,
        usage: [],
        error: ERROR_MESSAGES.API.REQUEST_FAILED(quotaResponse.status, quotaResponse.statusText),
        lastUpdated: new Date().toISOString()
      }
    }

    const data = (await quotaResponse.json()) as any
    const usage: UsageCategory[] = []

    // 动态遍历 API 返回的所有模型
    const models = data.models || {}
    for (const [modelId, modelData] of Object.entries(models)) {
      const m = modelData as any
      if (m?.quotaInfo) {
        const remainingFraction = m.quotaInfo.remainingFraction ?? 0
        usage.push({
          name: formatModelName(modelId),
          limitType: 'request',
          used: Math.round((1 - remainingFraction) * 100),
          total: 100,
          percentageOnly: true,
          resetTime: m.quotaInfo.resetTime
        })
      }
    }

    // Sort by usage percentage (ascending - more remaining first)
    usage.sort((a, b) => {
      const pA = a.total > 0 ? (a.used / a.total) : 0
      const pB = b.total > 0 ? (b.used / b.total) : 0
      return pA - pB
    })

    return {
      success: true,
      usage,
      lastUpdated: new Date().toISOString()
    }
  } catch (e: any) {
    const message = e.message || String(e)
    if (message.includes('fetch failed')) {
      return {
        success: false,
        usage: [],
        error: ERROR_MESSAGES.API.NETWORK_ERROR(message),
        lastUpdated: new Date().toISOString()
      }
    }
    return {
      success: false,
      usage: [],
      error: ERROR_MESSAGES.API.UNKNOWN(message),
      lastUpdated: new Date().toISOString()
    }
  }
}
