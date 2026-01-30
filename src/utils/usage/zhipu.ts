import type { FetchUsageResult, UsageCategory } from '../../types'
import { ERROR_MESSAGES } from '../../constants'

export async function fetchZhipuUsage(
  providerId: 'zhipu' | 'zai',
  apiKey: string
): Promise<FetchUsageResult> {
  const url =
    providerId === 'zhipu'
      ? 'https://bigmodel.cn/api/monitor/usage/quota/limit'
      : 'https://api.z.ai/api/monitor/usage/quota/limit'

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
        'User-Agent': 'UnifyQuotaMonitor/1.0'
      }
    })

    if (!response.ok) {
      return {
        success: false,
        usage: [],
        error: ERROR_MESSAGES.API.REQUEST_FAILED(response.status, response.statusText),
        lastUpdated: new Date().toISOString()
      }
    }

    const data = (await response.json()) as any
    const usage: UsageCategory[] = []

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

        usage.push({
          name: l.type === 'TOKENS_LIMIT' ? 'Token Limit' : 'MCP Quota',
          limitType: l.type === 'TOKENS_LIMIT' ? 'token' : 'request',
          used: l.currentValue,
          total: l.usage,
          resetTime: resetDate ? resetDate.toISOString() : undefined
        })
      }

      // Sort: Token Limit first, then by usage percentage (ascending)
      usage.sort((a, b) => {
        if (a.limitType === 'token' && b.limitType !== 'token') return -1
        if (a.limitType !== 'token' && b.limitType === 'token') return 1

        const pA = a.total > 0 ? (a.used / a.total) : 0
        const pB = b.total > 0 ? (b.used / b.total) : 0
        return pA - pB
      })
    }

    return {
      success: true,
      usage,
      lastUpdated: new Date().toISOString()
    }
  } catch (e: any) {
    return {
      success: false,
      usage: [],
      error: ERROR_MESSAGES.API.UNKNOWN(e.message || e),
      lastUpdated: new Date().toISOString()
    }
  }
}
