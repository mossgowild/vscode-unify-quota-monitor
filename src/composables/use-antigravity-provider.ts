/* eslint-disable @typescript-eslint/naming-convention */
import { defineService } from 'reactive-vscode'
import { useGoogleProvider } from './use-google-provider'
import type { UsageItem } from '../types'

export const useAntigravityProvider = defineService(() =>
  useGoogleProvider({
    id: 'antigravity',
    name: 'Google Antigravity',
    clientId:
      '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/cclog',
      'https://www.googleapis.com/auth/experimentsandconfigs',
    ],
    fetchUsage: async (credential): Promise<UsageItem[]> => {
      // credential 是 refresh_token，需要用它获取 access_token 来调用 API
      const tokensResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:
            '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
          grant_type: 'refresh_token',
          refresh_token: credential,
        }),
      })

      if (!tokensResponse.ok) {
        throw new Error(`Token refresh failed: ${tokensResponse.statusText}`)
      }

      const tokens = (await tokensResponse.json()) as { access_token: string }

      const response = await fetch(
        'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
        {
          method: 'POST',
          headers: {
            'User-Agent': 'antigravity/1.11.9',
            Authorization: `Bearer ${tokens.access_token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ project: 'rising-fact-p41fc' }),
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch usage: ${response.statusText}`)
      }

      const data = (await response.json()) as {
        models?: Record<
          string,
          {
            quotaInfo?: {
              remainingFraction?: number
              resetTime?: string
            }
          }
        >
      }

      const usage: UsageItem[] = []

      for (const [modelId, modelData] of Object.entries(data.models || {})) {
        if (!modelData?.quotaInfo) continue
        const remainingFraction = modelData.quotaInfo.remainingFraction ?? 0
        usage.push({
          name: modelId,
          type: 'percentage',
          used: Math.round((1 - remainingFraction) * 100),
          total: 100,
          resetTime: modelData.quotaInfo.resetTime,
        })
      }

      return usage
    },
  })
)
