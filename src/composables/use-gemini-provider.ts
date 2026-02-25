/* eslint-disable @typescript-eslint/naming-convention */
import { defineService } from 'reactive-vscode'
import { useGoogleProvider } from './use-google-provider'
import type { UsageItem } from '../types'

interface GeminiCredential {
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  tokenType?: string
}

export const useGeminiProvider = defineService(() =>
  useGoogleProvider({
    id: 'gemini',
    name: 'Gemini CLI',
    clientId:
      '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com',
    clientSecret: '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',
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    fetchUsage: async (credential: string): Promise<UsageItem[]> => {
      let credentialData: GeminiCredential
      try {
        credentialData = JSON.parse(credential) as GeminiCredential
      } catch {
        throw new Error('Invalid credential format')
      }

      const accessToken = credentialData.accessToken || ''
      const refreshToken = credentialData.refreshToken

      if (!accessToken && !refreshToken) {
        throw new Error('No access token or refresh token available')
      }

      const makeRequest = async <T>(url: string, body: object): Promise<T> => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'User-Agent': 'gemini-cli/1.0',
            'content-type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify(body)
        })

        if (!response.ok) {
          throw new Error(`Request failed: ${response.statusText}`)
        }

        return response.json() as Promise<T>
      }

      const loadResult = await makeRequest<{
        cloudaicompanionProject?: string
      }>('https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist', {
        metadata: {
          ideType: 'IDE_UNSPECIFIED',
          platform: 'PLATFORM_UNSPECIFIED',
          pluginType: 'GEMINI'
        }
      })

      if (!loadResult?.cloudaicompanionProject) {
        throw new Error('Failed to load project')
      }

      const quotaResult = await makeRequest<{
        buckets?: Array<{
          modelId: string
          remainingFraction: number
          resetTime?: string
        }>
      }>('https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota', {
        project: loadResult.cloudaicompanionProject
      })

      if (!quotaResult?.buckets) {
        throw new Error('Failed to fetch quota')
      }

      return quotaResult.buckets.map((bucket) => ({
        name: bucket.modelId,
        type: 'percentage',
        used: Math.round((1 - bucket.remainingFraction) * 100),
        total: 100,
        resetTime: bucket.resetTime
      }))
    },
  })
)
