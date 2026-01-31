import type { FetchUsageResult, UsageCategory } from '../../types'
import { refreshAntigravityToken } from '../auth/antigravity'
import { ERROR_MESSAGES } from '../../constants'

const modelMap = new Map([
  ['claude-opus-4-5-thinking', 'Claude Opus 4.5'],
  ['gemini-3-pro-high', 'Gemini 3 Pro'],
  ['gemini-3-flash', 'Gemini 3 Flash'],
  ['gemini-3-pro-image', 'Gemini 3 Image']
])

export async function fetchGoogleAntigravityUsage(
  refreshToken: string,
  onTokenRefreshed?: (newRefreshToken: string) => Promise<void>
): Promise<FetchUsageResult> {
  try {
    const token = await refreshAntigravityToken(refreshToken)

    // If token was refreshed, notify caller
    if (token !== refreshToken && onTokenRefreshed) {
      await onTokenRefreshed(token)
    }

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

    for (const [key, label] of modelMap.entries()) {
      const m = data.models?.[key]
      if (m?.quotaInfo) {
        const remainingFraction = m.quotaInfo.remainingFraction ?? 0
        usage.push({
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
