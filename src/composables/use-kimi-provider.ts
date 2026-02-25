/* eslint-disable @typescript-eslint/naming-convention */
import { defineService } from 'reactive-vscode'
import { useApiKeyProvider } from './use-api-key-provider'
import type { UsageItem } from '../types'

export const useKimiProvider = defineService(() =>
  useApiKeyProvider({
    id: 'kimi',
    name: 'Kimi Code',
    keyPrefix: 'sk-kimi',
    fetchUsage: async (apiKey): Promise<UsageItem[]> => {
      const response = await fetch('https://api.kimi.com/coding/v1/usages', {
        headers: {
          'User-Agent': 'UnifyQuotaMonitor/1.0',
          Authorization: `Bearer ${apiKey}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch usage: ${response.statusText}`)
      }

      const data = (await response.json()) as {
        usage?: {
          used?: number
          limit?: number
          resetTime?: string
        }
        limits?: Array<{
          detail?: {
            used?: number
            limit?: number
            resetTime?: string
          }
        }>
      }

      const usage: UsageItem[] = []
      const details: UsageItem[] = []

      if (data.usage) {
        const used = Number(data.usage.used) || 0
        const total = Number(data.usage.limit) || 0
        const percentage = total > 0 ? Math.round((used / total) * 100) : 0

        usage.push({
          name: 'Weekly Usage',
          type: 'percentage',
          used: percentage,
          total: 100,
          resetTime: data.usage.resetTime || undefined
        })
      }

      if (Array.isArray(data.limits)) {
        for (const limit of data.limits) {
          if (!limit.detail) continue
          const used = Number(limit.detail.used) || 0
          const total = Number(limit.detail.limit) || 0
          const percentage = total > 0 ? Math.round((used / total) * 100) : 0
          details.push({
            name: 'Rate Limit Details',
            type: 'percentage',
            used: percentage,
            total: 100,
            resetTime: limit.detail.resetTime || undefined
          })
        }
      }

      details.push(...usage)
      return details
    }
  })
)
