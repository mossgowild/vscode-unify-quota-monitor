/* eslint-disable @typescript-eslint/naming-convention */
import { env, window, Uri } from 'vscode'
import { waitForOAuthCallback } from './oauth'

const ANTIGRAVITY_OAUTH = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  callbackPort: 51121,
  redirectUri: 'http://localhost:51121/oauth-callback',
  scopes: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/cclog',
    'https://www.googleapis.com/auth/experimentsandconfigs'
  ]
} as const

export async function exchangeAntigravityCode(code: string): Promise<any> {
  const params = new URLSearchParams()
  params.set('client_id', '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com')
  params.set('client_secret', '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')
  params.set('code', code)
  params.set('grant_type', 'authorization_code')
  params.set('redirect_uri', ANTIGRAVITY_OAUTH.redirectUri)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

export async function loginWithAntigravity(): Promise<string> {
  const state = Math.random().toString(36).substring(7)
  const authUrl = new URL(ANTIGRAVITY_OAUTH.authUrl)
  authUrl.searchParams.set('client_id', '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com')
  authUrl.searchParams.set('redirect_uri', ANTIGRAVITY_OAUTH.redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', ANTIGRAVITY_OAUTH.scopes.join(' '))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  await env.openExternal(Uri.parse(authUrl.toString()))

  const result = await window.withProgress(
    {
      location: { viewId: 'unifyQuotaMonitor.usageView' },
      title: 'Waiting for Antigravity authorization...',
      cancellable: true
    },
    async () => {
      return waitForOAuthCallback(ANTIGRAVITY_OAUTH.callbackPort, '/oauth-callback', state)
    }
  )

  if (!result) {
    throw new Error('Authentication failed')
  }

  const tokens = await exchangeAntigravityCode(result)
  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned')
  }

  return tokens.refresh_token
}

export async function refreshAntigravityToken(refreshToken: string): Promise<string> {
  const params = new URLSearchParams()
  params.set('client_id', '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com')
  params.set('client_secret', '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')
  params.set('refresh_token', refreshToken)
  params.set('grant_type', 'refresh_token')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  if (!response.ok) {
    throw new Error('Antigravity token refresh failed')
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const tokenData = (await response.json()) as { access_token: string }
  return tokenData.access_token
}
