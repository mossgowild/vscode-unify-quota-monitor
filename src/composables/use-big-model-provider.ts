/* eslint-disable @typescript-eslint/naming-convention */
import { useApiKeyProvider } from './use-api-key-provider'
import type { ProviderId, UsageItem } from '../types'

export interface BigModelProviderOptions {
  id: ProviderId
  name: string
  keyPrefix: string
  apiUrl: string
}

export function useBigModelProvider(options: BigModelProviderOptions) {
  return useApiKeyProvider({
    id: options.id,
    name: options.name,
    keyPrefix: options.keyPrefix,
    fetchUsage: async (apiKey): Promise<UsageItem[]> => {
      const response = await fetch(options.apiUrl, {
        headers: {
          'User-Agent': 'UnifyQuotaMonitor/1.0',
          Authorization: apiKey
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch usage: ${response.statusText}`)
      }

      const data = (await response.json()) as {
        success?: boolean
        data?: {
          limits?: Array<{
            type?: string
            percentage?: number
            currentValue?: number
            usage?: number
            nextResetTime?: string
            next_reset_time?: string
            resetTime?: string
            reset_time?: string
          }>
        }
      }

      const limits = data?.data?.limits
      if (!data?.success || !Array.isArray(limits)) {
        return []
      }

      const usage: UsageItem[] = []

      for (const limit of limits) {
        const rawResetTime =
          limit.nextResetTime ||
          limit.next_reset_time ||
          limit.resetTime ||
          limit.reset_time

        const resetDate = rawResetTime ? new Date(rawResetTime) : undefined

        let used: number
        let total: number
        let type: 'percentage' | 'quantity'

        if (limit.type === 'TOKENS_LIMIT') {
          type = 'percentage'
          used = Number(limit.percentage) || 0
          total = 100
        } else {
          type = 'quantity'
          used = Number(limit.currentValue) || 0
          total = Number(limit.usage) || 0
        }

        usage.push({
          name:
            limit.type === 'TOKENS_LIMIT'
              ? 'Token Limit'
              : limit.type === 'TIME_LIMIT'
                ? 'Time Limit'
                : 'MCP Quota',
          type,
          used,
          total,
          resetTime: resetDate?.toISOString()
        })
      }

      return usage
    }
  })
}
