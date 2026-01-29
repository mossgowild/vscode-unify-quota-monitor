/* eslint-disable @typescript-eslint/naming-convention */
import { env, window, Uri } from 'vscode'
import { waitForOAuthCallback } from './oauth'

// Official Gemini CLI OAuth credentials (from google-gemini/gemini-cli open source)
const GEMINI_CLI_OAUTH = {
  clientId: '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com',
  clientSecret: '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',
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ]
} as const

export async function loginWithGeminiCli(): Promise<string> {
  const state = Math.random().toString(36).substring(7)
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GEMINI_CLI_OAUTH.clientId)
  authUrl.searchParams.set('redirect_uri', 'http://localhost:51121/oauth-callback')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', GEMINI_CLI_OAUTH.scopes.join(' '))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  await env.openExternal(Uri.parse(authUrl.toString()))

  const result = await window.withProgress(
    {
      location: { viewId: 'unifyQuotaMonitor.usageView' },
      title: 'Waiting for Gemini CLI authorization...',
      cancellable: true
    },
    async () => {
      return waitForOAuthCallback(51121, '/oauth-callback', state)
    }
  )

  if (!result) {
    throw new Error('Authentication failed')
  }

  // Exchange code for tokens
  const params = new URLSearchParams()
  params.set('client_id', GEMINI_CLI_OAUTH.clientId)
  params.set('client_secret', GEMINI_CLI_OAUTH.clientSecret)
  params.set('code', result)
  params.set('grant_type', 'authorization_code')
  params.set('redirect_uri', 'http://localhost:51121/oauth-callback')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const tokens = await response.json() as { refresh_token?: string; access_token: string; expires_in: number; token_type: string }
  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned')
  }

  const credentialData = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    tokenType: tokens.token_type
  }
  return JSON.stringify(credentialData)
}

export async function refreshGeminiCliToken(credentialJson: string): Promise<{ newCredential: string; accessToken: string } | null> {
  let refreshToken = ''

  try {
    const json = JSON.parse(credentialJson) as { refreshToken?: string }
    if (json.refreshToken) {
      refreshToken = json.refreshToken
    }
  } catch {
    return null
  }

  if (!refreshToken) {
    return null
  }

  try {
    const params = new URLSearchParams()
    params.set('client_id', GEMINI_CLI_OAUTH.clientId)
    params.set('client_secret', GEMINI_CLI_OAUTH.clientSecret)
    params.set('refresh_token', refreshToken)
    params.set('grant_type', 'refresh_token')

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    if (!response.ok) {
      return null
    }

    const newData = (await response.json()) as { access_token: string; expires_in: number; token_type: string }

    const newCredential = JSON.stringify({
      accessToken: newData.access_token,
      refreshToken: refreshToken,
      expiresIn: newData.expires_in,
      tokenType: newData.token_type
    })

    return {
      newCredential,
      accessToken: newData.access_token
    }
  } catch {
    return null
  }
}
