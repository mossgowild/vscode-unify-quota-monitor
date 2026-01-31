import type { FetchUsageResult, UsageCategory } from '../../types'
import { ERROR_MESSAGES } from '../../constants'

/**
 * Fetch Kimi Code usage data
 * @param apiKey - Kimi Code API Key (format: sk-kimi...)
 * @returns Usage data with weekly usage and rate limits
 */
export async function fetchKimiCodeUsage(
  apiKey: string,
): Promise<FetchUsageResult> {
  const url = 'https://api.kimi.com/coding/v1/usages'

  try {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const response = await fetch(url, {
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Authorization: `Bearer ${apiKey}`,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'User-Agent': 'UnifyQuotaMonitor/1.0',
      },
    })

    if (!response.ok) {
      return {
        success: false,
        usage: [],
        error: ERROR_MESSAGES.API.REQUEST_FAILED(response.status, response.statusText),
        lastUpdated: new Date().toISOString(),
      }
    }

    const data = (await response.json()) as any
    const usage: UsageCategory[] = []
    const rateLimitDetails: UsageCategory[] = []

    // Parse weekly usage (main usage field) - add first to ensure it appears first
    if (data.usage) {
      const used = Number(data.usage.used) || 0
      const total = Number(data.usage.limit) || 0
      const percentage = total > 0 ? Math.round((used / total) * 100) : 0

      const weeklyUsage: UsageCategory = {
        name: 'Weekly Usage',
        limitType: 'request',
        used: percentage,
        total: 100,
        percentageOnly: true,
        resetTime: data.usage.resetTime || undefined,
      }
      usage.push(weeklyUsage)
    }

    // Parse rate limits (limits array)
    if (data.limits && Array.isArray(data.limits)) {
      for (const limit of data.limits) {
        if (limit.detail) {
          const used = Number(limit.detail.used) || 0
          const total = Number(limit.detail.limit) || 0
          const percentage = total > 0 ? Math.round((used / total) * 100) : 0

          rateLimitDetails.push({
            name: 'Rate Limit Details',
            limitType: 'request',
            used: percentage,
            total: 100,
            percentageOnly: true,
            resetTime: limit.detail.resetTime || undefined,
          })
        }
      }
    }

    // Sort rate limit details by usage percentage (ascending - more remaining first)
    rateLimitDetails.sort((a, b) => {
      const percentageA = a.used / a.total
      const percentageB = b.used / b.total
      return percentageA - percentageB
    })

    // Add sorted rate limit details after weekly usage
    usage.push(...rateLimitDetails)

    return {
      success: true,
      usage,
      lastUpdated: new Date().toISOString(),
    }
  }
  catch (e: any) {
    return {
      success: false,
      usage: [],
      error: ERROR_MESSAGES.API.UNKNOWN(e.message || e),
      lastUpdated: new Date().toISOString(),
    }
  }
}
