/* eslint-disable @typescript-eslint/naming-convention */
import { env, window, Uri, authentication } from 'vscode'
import {
  generateRandomString,
  generatePkce,
  waitForOAuthCallback,
  exchangeGoogleCode,
  exchangeOpenAICode
} from './oauth-helpers'

const GOOGLE_OAUTH = {
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

const OPENAI_OAUTH = {
  issuer: 'https://auth.openai.com',
  clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
  callbackPort: 1455,
  redirectPath: '/auth/callback',
  scope: 'openid profile email offline_access'
} as const

export async function loginWithGoogle(): Promise<string> {
  const state = Math.random().toString(36).substring(7)
  const authUrl = new URL(GOOGLE_OAUTH.authUrl)
  authUrl.searchParams.set('client_id', '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com')
  authUrl.searchParams.set('redirect_uri', GOOGLE_OAUTH.redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', GOOGLE_OAUTH.scopes.join(' '))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  await env.openExternal(Uri.parse(authUrl.toString()))

  const result = await window.withProgress(
    {
      location: { viewId: 'unifyQuotaMonitor.usageView' },
      title: 'Waiting for Google authorization...',
      cancellable: true
    },
    async () => {
      return waitForOAuthCallback(GOOGLE_OAUTH.callbackPort, '/oauth-callback', state)
    }
  )

  if (!result) {
    throw new Error('Authentication failed')
  }

  const tokens = await exchangeGoogleCode(result)
  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned')
  }

  return tokens.refresh_token
}

export async function loginWithOpenAI(): Promise<string> {
  const { verifier, challenge } = generatePkce()
  const state = generateRandomString(32)

  const url = new URL(`${OPENAI_OAUTH.issuer}/oauth/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', OPENAI_OAUTH.clientId)
  url.searchParams.set('redirect_uri', `http://localhost:${OPENAI_OAUTH.callbackPort}${OPENAI_OAUTH.redirectPath}`)
  url.searchParams.set('scope', OPENAI_OAUTH.scope)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('id_token_add_organizations', 'true')
  url.searchParams.set('codex_cli_simplified_flow', 'true')
  url.searchParams.set('state', state)
  url.searchParams.set('originator', 'opencode')

  await env.openExternal(Uri.parse(url.toString()))

  const result = await window.withProgress(
    {
      location: { viewId: 'unifyQuotaMonitor.usageView' },
      title: 'Waiting for OpenAI authorization...',
      cancellable: true
    },
    async () => {
      return waitForOAuthCallback(OPENAI_OAUTH.callbackPort, OPENAI_OAUTH.redirectPath, state)
    }
  )

  if (!result) {
    throw new Error('Authentication failed')
  }

  const tokens = await exchangeOpenAICode(result, verifier)
  if (!tokens.access_token) {
    throw new Error('No access token returned')
  }

  const credentialData = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    tokenType: tokens.token_type
  }
  return JSON.stringify(credentialData)
}

export async function loginWithOpenAIToken(): Promise<string> {
  const credential = await window.showInputBox({
    title: 'Enter OpenAI Access Token',
    prompt: 'Manually enter JWT Token',
    password: true,
    ignoreFocusOut: true
  })

  if (!credential) {
    throw new Error('Canceled')
  }

  return credential
}

export async function loginWithApiKey(
  providerId: 'zhipu' | 'zai'
): Promise<string> {
  const config: Record<string, any> = {
    zhipu: {
      providerName: 'Zhipu AI',
      helpUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
      prefix: 'sk.',
      buttonTextKey: 'Open docs to get Key'
    },
    zai: {
      providerName: 'Z.ai',
      helpUrl: 'https://zai.sh/',
      prefix: 'zai_',
      buttonTextKey: 'Open website to get Key'
    }
  }

  const providerConfig = config[providerId]

  const openDocsAction = await window.showInformationMessage(
    `${providerConfig.providerName} API Key`,
    providerConfig.buttonTextKey
  )

  if (openDocsAction) {
    await env.openExternal(Uri.parse(providerConfig.helpUrl))
  }

  const apiKey = await window.showInputBox({
    title: `Enter ${providerConfig.providerName} API Key`,
    prompt: `Format: ${providerConfig.prefix}xxxxxxxxx (starts with ${providerConfig.prefix})`,
    password: true,
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (!value?.trim()) {
        return 'API Key cannot be empty'
      }
      if (!value.startsWith(providerConfig.prefix)) {
        return `Invalid API Key format, should start with ${providerConfig.prefix}`
      }
      return null
    }
  })

  if (!apiKey) {
    throw new Error('Canceled')
  }

  return apiKey
}

export async function refreshGoogleToken(refreshToken: string): Promise<string> {
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
    throw new Error('Google token refresh failed')
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const tokenData = (await response.json()) as { access_token: string }
  return tokenData.access_token
}

export async function refreshOpenAIToken(
  credentialJson: string
): Promise<{ newCredential: string; accessToken: string } | null> {
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
    params.set('grant_type', 'refresh_token')
    params.set('refresh_token', refreshToken)
    params.set('client_id', 'app_EMoamEEZ73f0CkXaXp7hrann')

    const response = await fetch('https://auth.openai.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    if (!response.ok) {
      return null
    }

    const newData = (await response.json()) as any

    const newCredential = JSON.stringify({
      accessToken: newData.access_token,
      refreshToken: newData.refresh_token || refreshToken,
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

export async function loginWithGitHub(): Promise<string> {
  await authentication.getSession('github', ['read:user'], { createIfNone: true })
  return 'vscode-github-session'
}

export async function getGitHubAccessToken(): Promise<string | null> {
  try {
    const session = await authentication.getSession('github', ['read:user'], { createIfNone: false })
    return session?.accessToken || null
  } catch {
    return null
  }
}

export async function exchangeGitHubTokenForCopilot(githubToken: string): Promise<string> {
  const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      'Authorization': `token ${githubToken}`,
      'User-Agent': 'GitHubCopilotChat/0.24.0',
      'Editor-Version': 'vscode/1.97.0',
      'Editor-Plugin-Version': 'copilot-chat/0.24.0',
      'Copilot-Integration-Id': 'vscode-chat'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to exchange token: ${response.statusText}`)
  }

  const data = await response.json() as any
  return data.token
}

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
