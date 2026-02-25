/* eslint-disable @typescript-eslint/naming-convention */
import { useOAuthProvider } from './use-oauth-provider'
import { formatModelName } from '../utils/format-model-name'
import type { ProviderId, UsageItem } from '../types'

interface GoogleTokenResponse {
  refresh_token?: string
  access_token?: string
}

export interface GoogleProviderOptions {
  id: ProviderId
  name: string
  fetchUsage: (credential: string) => Promise<UsageItem[]>
  clientId: string
  scopes: string[]
  clientSecret?: string
}

export function useGoogleProvider(options: GoogleProviderOptions) {
  const fetchUsage = async (credential: string): Promise<UsageItem[]> => {
    const usage = await options.fetchUsage(credential)
    return usage.map((item) => ({
      ...item,
      name: formatModelName(item.name)
    }))
  }

  const exchangeCode = async (code: string): Promise<string> => {
    // 如果只需要存储 code 或 refresh_token，直接返回 code
    // 实际的 token 交换逻辑在具体 provider 中实现
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: options.clientId,
        grant_type: 'authorization_code',
        redirect_uri: 'http://localhost:51121/callback',
        ...(options.clientSecret ? { client_secret: options.clientSecret } : {})
      })
    })

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`)
    }

    const data = (await response.json()) as GoogleTokenResponse
    return data.refresh_token || data.access_token || ''
  }

  const getAuthUrl = (state: string): string => {
    const params = new URLSearchParams({
      client_id: options.clientId,
      redirect_uri: 'http://localhost:51121/callback',
      response_type: 'code',
      scope: options.scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent'
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  return useOAuthProvider({
    id: options.id,
    name: options.name,
    fetchUsage,
    getAuthUrl,
    exchangeCode,
    port: 51121
  })
}
