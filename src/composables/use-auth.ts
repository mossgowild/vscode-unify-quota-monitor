import * as http from 'node:http'
import * as crypto from 'node:crypto'
import { env, QuickPickItemKind, Uri, window, type QuickPickItem } from 'vscode'
import type { ProviderId, StoredAccount } from '../types'
import { getAllProviderDefinitions, getProviderDefinition } from '../providers'
import { t } from '../i18n'
import { useAccounts } from './use-accounts'
import { useUsage } from './use-usage'

interface MenuItem extends QuickPickItem {
  action?: string
  accountId?: string
  providerId?: ProviderId
  kind?: QuickPickItemKind
}

const GOOGLE_OAUTH = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  clientId:
    '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
  clientSecret: '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',
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
  get redirectUri() {
    return `http://localhost:${this.callbackPort}${this.redirectPath}`
  },
  scope: 'openid profile email offline_access'
} as const

export function useAuth() {
  const {
    getStoredAccounts,
    getAccount,
    saveAccount,
    deleteAccount,
    generateAccountId,
    getAccountsByProvider
  } = useAccounts()
  const { refresh } = useUsage()

  function generateRandomString(length: number): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    let out = ''
    const bytes = crypto.randomBytes(length)
    for (let i = 0; i < length; i++) {
      out += charset[bytes[i] % charset.length]
    }
    return out
  }

  function generatePkce() {
    const verifier = generateRandomString(43)
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url')
    return { verifier, challenge }
  }

  async function exchangeCodeForToken(code: string): Promise<any> {
    const params = new URLSearchParams()
    params.set('client_id', GOOGLE_OAUTH.clientId)
    params.set('client_secret', GOOGLE_OAUTH.clientSecret)
    params.set('code', code)
    params.set('grant_type', 'authorization_code')
    params.set('redirect_uri', GOOGLE_OAUTH.redirectUri)

    const response = await fetch(GOOGLE_OAUTH.tokenUrl, {
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

  async function exchangeOpenAICode(
    code: string,
    verifier: string
  ): Promise<any> {
    const params = new URLSearchParams()
    params.set('grant_type', 'authorization_code')
    params.set('code', code)
    params.set('redirect_uri', OPENAI_OAUTH.redirectUri)
    params.set('client_id', OPENAI_OAUTH.clientId)
    params.set('code_verifier', verifier)

    const response = await fetch(`${OPENAI_OAUTH.issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI Token Exchange Failed: ${error}`)
    }

    return response.json()
  }

  async function refreshGoogleToken(refreshToken: string): Promise<string> {
    const params = new URLSearchParams()
    params.set('client_id', GOOGLE_OAUTH.clientId)
    params.set('client_secret', GOOGLE_OAUTH.clientSecret)
    params.set('refresh_token', refreshToken)
    params.set('grant_type', 'refresh_token')

    const response = await fetch(GOOGLE_OAUTH.tokenUrl, {
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

  async function refreshOpenAIToken(
    account: StoredAccount
  ): Promise<string | null> {
    let refreshToken = ''

    try {
      const json = JSON.parse(account.credential) as { refreshToken?: string }
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
      params.set('client_id', OPENAI_OAUTH.clientId)

      const response = await fetch(`${OPENAI_OAUTH.issuer}/oauth/token`, {
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

      await saveAccount({
        ...account,
        credential: newCredential
      })

      return newData.access_token
    } catch {
      return null
    }
  }

  async function saveAccountWithAlias(
    account: StoredAccount,
    providerName: string,
    successMsg: string
  ): Promise<void> {
    const alias = await window.showInputBox({
      title: t('Account Alias (Optional)'),
      prompt: t(
        'Set an alias for this account to distinguish multiple accounts'
      ),
      placeHolder: t('e.g. Work, Personal, Team, etc.'),
      value: account.alias || ''
    })

    if (alias) {
      account.alias = alias
    }

    await saveAccount(account)
    window.showInformationMessage(successMsg)

    await refresh(account.providerId)
  }

  async function loginWithGoogle(existingAccountId?: string): Promise<void> {
    const state = Math.random().toString(36).substring(7)
    const authUrl = new URL(GOOGLE_OAUTH.authUrl)
    authUrl.searchParams.set('client_id', GOOGLE_OAUTH.clientId)
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
        title: t('Waiting for Google authorization...'),
        cancellable: true
      },
      async (_progress, token) => {
        return new Promise<string | null>((resolve) => {
          const server = http.createServer(async (req, res) => {
            const url = new URL(
              req.url || '',
              `http://localhost:${GOOGLE_OAUTH.callbackPort}`
            )
            if (url.pathname !== '/oauth-callback') {
              res.statusCode = 404
              res.end('Not Found')
              return
            }

            const code = url.searchParams.get('code')
            const returnedState = url.searchParams.get('state')

            if (returnedState !== state) {
              res.end('Invalid state. Please try again.')
              return
            }

            if (code) {
              res.end(
                t(
                  'Authentication successful! You can close this tab and return to VS Code.'
                )
              )
              server.close()
              resolve(code)
            }
          })

          server.on('error', () => {
            server.close()
            resolve(null)
          })

          server.listen(GOOGLE_OAUTH.callbackPort)

          token.onCancellationRequested(() => {
            server.close()
            resolve(null)
          })
        })
      }
    )

    if (!result) {
      window.showErrorMessage(t('Authentication failed'))
      return
    }

    try {
      const tokens = await exchangeCodeForToken(result)
      if (tokens.refresh_token) {
        const accountId = existingAccountId || generateAccountId('google')
        const account: StoredAccount = {
          id: accountId,
          providerId: 'google',
          credential: tokens.refresh_token
        }

        await saveAccountWithAlias(
          account,
          'Google Antigravity',
          t('Successfully logged in to Google Antigravity')
        )
      } else {
        throw new Error(t('No refresh token returned'))
      }
    } catch (err: any) {
      window.showErrorMessage(`${t('Authentication failed')}: ${err.message}`)
    }
  }

  async function loginWithOpenAI(existingAccountId?: string): Promise<void> {
    const { verifier, challenge } = generatePkce()
    const state = generateRandomString(32)

    const url = new URL(`${OPENAI_OAUTH.issuer}/oauth/authorize`)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', OPENAI_OAUTH.clientId)
    url.searchParams.set('redirect_uri', OPENAI_OAUTH.redirectUri)
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
        title: t('Waiting for OpenAI authorization...'),
        cancellable: true
      },
      async (_progress, token) => {
        return new Promise<string | null>((resolve) => {
          const server = http.createServer(async (req, res) => {
            const reqUrl = new URL(
              req.url || '',
              `http://localhost:${OPENAI_OAUTH.callbackPort}`
            )
            if (reqUrl.pathname !== OPENAI_OAUTH.redirectPath) {
              res.statusCode = 404
              res.end('Not Found')
              return
            }

            const code = reqUrl.searchParams.get('code')
            const returnedState = reqUrl.searchParams.get('state')

            if (returnedState !== state) {
              res.end('Invalid state. Please try again.')
              return
            }

            if (code) {
              res.end(t('Authentication successful!'))
              server.close()
              resolve(code)
            }
          })

          server.on('error', () => {
            server.close()
            resolve(null)
          })

          server.listen(OPENAI_OAUTH.callbackPort)

          token.onCancellationRequested(() => {
            server.close()
            resolve(null)
          })
        })
      }
    )

    if (!result) {
      return
    }

    try {
      const tokens = await exchangeOpenAICode(result, verifier)
      if (tokens.access_token) {
        const accountId = existingAccountId || generateAccountId('openai')
        const account: StoredAccount = {
          id: accountId,
          providerId: 'openai',
          credential: JSON.stringify({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expires_in,
            tokenType: tokens.token_type
          })
        }

        await saveAccountWithAlias(
          account,
          'OpenAI Codex',
          t('Successfully logged in to OpenAI Codex')
        )
      }
    } catch (err: any) {
      window.showErrorMessage(`${t('Authentication failed')}: ${err.message}`)
    }
  }

  interface ApiKeyConfig {
    providerId: 'zhipu' | 'zai'
    providerName: string
    helpUrl: string
    prefix: string
    buttonTextKey: string
  }

  const API_KEY_CONFIGS: Record<'zhipu' | 'zai', ApiKeyConfig> = {
    zhipu: {
      providerId: 'zhipu',
      providerName: t('Zhipu AI'),
      helpUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
      prefix: 'sk.',
      buttonTextKey: 'Open docs to get Key'
    },
    zai: {
      providerId: 'zai',
      providerName: 'Z.ai',
      helpUrl: 'https://zai.sh/',
      prefix: 'zai_',
      buttonTextKey: 'Open website to get Key'
    }
  }

  async function loginWithApiKey(
    providerId: 'zhipu' | 'zai',
    existingAccountId?: string
  ): Promise<void> {
    const config = API_KEY_CONFIGS[providerId]

    const openDocsAction = await window.showInformationMessage(
      `${config.providerName} API Key`,
      t(config.buttonTextKey)
    )

    if (openDocsAction) {
      await env.openExternal(Uri.parse(config.helpUrl))
    }

    const apiKey = await window.showInputBox({
      title: t('Enter {providerName} API Key', {
        providerName: config.providerName
      }),
      prompt: t('Format: {prefix}xxxxxxxxx (starts with {prefix})', {
        prefix: config.prefix
      }),
      password: true,
      ignoreFocusOut: true,
      validateInput: (value: string) => {
        if (!value?.trim()) {
          return t('API Key cannot be empty')
        }
        if (!value.startsWith(config.prefix)) {
          return t('Invalid API Key format, should start with {prefix}', {
            prefix: config.prefix
          })
        }
        return null
      }
    })

    if (!apiKey) {
      return
    }

    const accountId = existingAccountId || generateAccountId(providerId)
    const account: StoredAccount = {
      id: accountId,
      providerId,
      credential: apiKey
    }

    await saveAccountWithAlias(
      account,
      config.providerName,
      t('Successfully logged in to {providerName}', {
        providerName: config.providerName
      })
    )
  }

  async function loginProvider(
    providerId: ProviderId,
    accountId?: string
  ): Promise<void> {
    const providerDef = getProviderDefinition(providerId)
    if (!providerDef) {
      return
    }

    if (providerId === 'google') {
      await loginWithGoogle(accountId)
      return
    }

    if (providerId === 'openai') {
      const method = await window.showQuickPick(
        [
          {
            label: t('OAuth Login (Recommended)'),
            description: t('For ChatGPT Plus/Pro'),
            detail: 'oauth'
          },
          {
            label: 'Access Token',
            description: t('Manually enter JWT Token'),
            detail: 'token'
          }
        ],
        { placeHolder: t('Select Login Method') }
      )

      if (!method) {
        return
      }

      if (method.detail === 'oauth') {
        await loginWithOpenAI(accountId)
        return
      }

      const credential = await window.showInputBox({
        title: `${t('Login to')} ${providerDef.name}`,
        prompt: providerDef.auth.placeholder,
        password: true,
        ignoreFocusOut: true
      })

      if (!credential) {
        return
      }

      const newAccountId = accountId || generateAccountId(providerId)
      const account: StoredAccount = {
        id: newAccountId,
        providerId,
        credential
      }

      await saveAccountWithAlias(
        account,
        providerDef.name,
        t('Successfully logged in to {providerName}', {
          providerName: providerDef.name
        })
      )
      return
    }

    if (providerId === 'zhipu' || providerId === 'zai') {
      await loginWithApiKey(providerId, accountId)
      return
    }
  }

  async function setAccountAlias(accountId: string): Promise<void> {
    const account = getAccount(accountId)
    if (!account) {
      return
    }

    const alias = await window.showInputBox({
      title: t('Account Alias'),
      prompt: t('Set an alias for this account'),
      value: account.alias || '',
      placeHolder: `${t('Current alias')}: ${account.alias || t('None')}`
    })

    if (alias === undefined) {
      return
    }

    const updatedAccount: StoredAccount = {
      id: account.id,
      providerId: account.providerId,
      alias: alias || undefined,
      credential: account.credential
    }

    await saveAccount(updatedAccount)

    await refresh(account.providerId)

    await showAccountActions(accountId)
  }

  async function reloginAccount(accountId: string): Promise<void> {
    const account = getAccount(accountId)
    if (!account) {
      return
    }
    await loginProvider(account.providerId, accountId)
    await showAccountMenu()
  }

  async function logoutAccount(accountId: string): Promise<void> {
    const account = getAccount(accountId)
    if (!account) {
      return
    }

    const providerDef = getProviderDefinition(account.providerId)
    const accountLabel = account.alias || accountId
    const providerName = providerDef?.name || account.providerId

    const confirmAction = await window.showWarningMessage(
      t(
        'Are you sure you want to logout from {providerName} - {accountLabel}?',
        { providerName, accountLabel }
      ),
      t('Confirm'),
      t('Cancel')
    )

    if (confirmAction !== t('Confirm')) {
      await showAccountMenu()
      return
    }

    await deleteAccount(accountId)
    window.showInformationMessage(
      t('Logged out from {providerName} - {accountLabel}', {
        providerName,
        accountLabel
      })
    )

    await refresh(account.providerId)

    await showAccountMenu()
  }

  async function showAccountActions(accountId: string): Promise<void> {
    const account = getAccount(accountId)
    if (!account) {
      return
    }

    const providerDef = getProviderDefinition(account.providerId)
    const accountLabel = account.alias || accountId

    const items: (QuickPickItem & { action?: string })[] = [
      { label: `$(arrow-left) ${t('Back')}`, action: 'back' },
      { label: '', kind: QuickPickItemKind.Separator },
      {
        label: `$(pencil) ${t('Set Alias')}`,
        description: t('Modify account alias'),
        action: 'setAlias'
      },
      {
        label: `$(sign-in) ${t('Relogin')}`,
        description: t("Update this account's credentials"),
        action: 'relogin'
      },
      {
        label: `$(sign-out) ${t('Logout')}`,
        description: t('Delete this account'),
        action: 'logout'
      }
    ]

    const selected = await window.showQuickPick(items, {
      title: `${providerDef?.name || account.providerId} - ${accountLabel}`,
      placeHolder: t('Select action')
    })

    if (!selected) {
      return
    }

    if (selected.action === 'back') {
      await showAccountMenu()
    } else if (selected.action === 'setAlias') {
      await setAccountAlias(accountId)
    } else if (selected.action === 'relogin') {
      await reloginAccount(accountId)
    } else if (selected.action === 'logout') {
      await logoutAccount(accountId)
    }
  }

  async function addProviderAccount(): Promise<void> {
    const providers = getAllProviderDefinitions()
    const items = providers.map((p) => ({
      label: p.name,
      description:
        p.auth.type === 'oauth'
          ? 'OAuth Login'
          : p.auth.type === 'key'
            ? 'API Key'
            : 'Access Token',
      providerId: p.id
    }))

    const selected = await window.showQuickPick(items, {
      title: t('Select Provider'),
      placeHolder: t('Select AI Provider to add')
    })

    if (!selected) {
      return
    }

    await loginProvider(selected.providerId)
  }

  async function showAccountMenu(): Promise<void> {
    const items: MenuItem[] = []
    const accounts = getStoredAccounts()

    if (accounts.length > 0) {
      for (const account of accounts) {
        const providerDef = getProviderDefinition(account.providerId)
        const accountLabel = account.alias || account.id
        items.push({
          label: `${providerDef?.name || account.providerId} - ${accountLabel}`,
          description: '',
          action: 'manageAccount',
          accountId: account.id,
          providerId: account.providerId
        })
      }

      items.push({ label: '', kind: QuickPickItemKind.Separator })
    }

    items.push({
      label: `$(plus) ${t('Add Provider')}`,
      description: t('Login to new AI Provider'),
      action: 'addProvider'
    })

    const selected = await window.showQuickPick(items, {
      title: t('Manage Accounts'),
      placeHolder: t('Manage accounts or add new Provider')
    })

    if (!selected) {
      return
    }

    if (selected.action === 'addProvider') {
      await addProviderAccount()
    } else if (selected.action === 'manageAccount' && selected.accountId) {
      await showAccountActions(selected.accountId)
    }
  }

  function hasAccounts(providerId: ProviderId): boolean {
    return getAccountsByProvider(providerId).length > 0
  }

  return {
    showAccountMenu,
    loginProvider,
    refreshGoogleToken,
    refreshOpenAIToken,
    hasAccounts
  }
}
