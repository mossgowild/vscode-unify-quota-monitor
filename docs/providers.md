# Providers

Provider implementations for different AI services.

## Overview

| Provider | Auth Type | Extends |
|----------|-----------|---------|
| Zhipu AI | API Key | `useApiKeyProvider` |
| Z.AI | API Key | `useBigModelProvider` → `useApiKeyProvider` |
| Kimi Code | API Key | `useApiKeyProvider` |
| Google Antigravity | OAuth | `useGoogleProvider` → `useOAuthProvider` |
| Gemini CLI | OAuth | `useGoogleProvider` → `useOAuthProvider` |
| GitHub Copilot | OAuth (VS Code) | `useOAuthProvider` |

## Base Provider

**File**: `src/composables/use-base-provider.ts`

Core provider logic managing accounts and refresh.

```typescript
export interface UseBaseProviderReturn {
  id: ProviderId
  name: string
  accounts: ComputedRef<ViewAccount[]>
  login: () => Promise<void>
  logout: (accountIndex: number) => void
  refresh: (accountIndex?: number) => Promise<void>
  rename: (accountIndex: number, name: string) => void
}
```

### Options

```typescript
interface BaseProviderOptions {
  id: ProviderId
  name: string
  fetchUsage: (credential: string) => Promise<UsageItem[]>
  authenticate: () => Promise<string>
  formatName?: (name: string) => string  // Optional name formatter
}
```

### Features

- **Array-based accounts**: Manages accounts as `ConfigAccount[]`
- **Reactive state**: `accountsData` ref updates trigger UI refresh
- **Centralized error handling**: All errors caught in `refresh()` and stored per account
- **Auto-refresh on config change**: Watches `accountsConfig` and auto-refreshes

## API Key Provider

**File**: `src/composables/use-api-key-provider.ts`

Base for API key authentication providers.

```typescript
export function useApiKeyProvider(options: {
  id: ProviderId
  name: string
  keyPrefix?: string
  placeholder?: string
  fetchUsage: (credential: string) => Promise<UsageItem[]>
}): UseBaseProviderReturn
```

### authenticate()

Shows input box with validation:

```typescript
const authenticate = async () => {
  const keyPrefix = options.keyPrefix || 'sk'
  const apiKey = await window.showInputBox({
    title: `Enter ${options.name} API Key`,
    prompt: `Format: ${keyPrefix}...`,
    password: true,
    validateInput: (value: string) => {
      if (!value?.trim()) return 'API Key is required'
      if (!value.startsWith(keyPrefix)) return `Key must start with ${keyPrefix}`
      return null
    },
  })
  if (!apiKey) throw new Error('Authentication cancelled')
  return apiKey.trim()
}
```

### Implementations

- **Kimi**: `sk-kimi` prefix
- **Zhipu**: `sk-` prefix

## OAuth Provider

**File**: `src/composables/use-oauth-provider.ts`

Base for OAuth authentication providers.

```typescript
export function useOAuthProvider(options: {
  id: ProviderId
  name: string
  authenticate: () => Promise<string>
  fetchUsage: (credential: string) => Promise<UsageItem[]>
}): UseBaseProviderReturn
```

### OAuth Callback Server

```typescript
const waitForOAuthCallback = async (
  port: number,
  path: string,
  state: string
): Promise<string> => {
  // Creates local HTTP server
  // Waits for callback with matching state
  // Returns authorization code
}
```

## Google Provider

**File**: `src/composables/use-google-provider.ts`

Shared Google OAuth implementation for Antigravity and Gemini.

### Features

- **Token refresh**: Automatic access token refresh on 401
- **Retry logic**: `requestWithRetry` handles expired tokens
- **Credential update**: Persists new tokens via `onCredentialChange`

```typescript
const requestWithRetry = async <T>(
  url: string,
  options: RequestInit,
  credentialData: { accessToken: string; refreshToken: string },
  formatFn: (data: T) => UsageItem[]
): Promise<UsageItem[]> => {
  try {
    return await request()
  } catch (error) {
    if (error.status === 401) {
      // Refresh token and retry
      const newToken = await refreshAccessToken(credentialData.refreshToken)
      credentialData.accessToken = newToken
      await onCredentialChange(JSON.stringify(credentialData))
      return await request()
    }
    throw error
  }
}
```

## Big Model Provider

**File**: `src/composables/use-big-model-provider.ts`

Shared fetch logic for Zhipu and Z.AI (both use BigModel API format).

```typescript
export function useBigModelProvider(options: {
  id: ProviderId
  name: string
  apiEndpoint: string
}): UseBaseProviderReturn
```

### API Format

Both providers share the same response format:

```typescript
interface BigModelUsageResponse {
  data: {
    available_models: Array<{
      model: string
      total_quota: number
      used_quota: number
    }>
  }
}
```

## Individual Providers

### Zhipu AI

**File**: `src/composables/use-zhipu-provider.ts`

```typescript
export const useZhipuProvider = defineService(() =>
  useBigModelProvider({
    id: 'zhipu',
    name: 'Zhipu AI',
    keyPrefix: 'sk.',
    apiUrl: 'https://bigmodel.cn/api/monitor/usage/quota/limit',
  })
)
```

### Z.AI

**File**: `src/composables/use-zai-provider.ts`

Uses `useBigModelProvider` (shares format with Zhipu):

```typescript
export const useZaiProvider = defineService(() =>
  useBigModelProvider({
    id: 'zai',
    name: 'Z.AI',
    keyPrefix: 'zai_',
    apiUrl: 'https://api.z.ai/v1'
  })
)
```

### Kimi Code

**File**: `src/composables/use-kimi-provider.ts`

```typescript
export function useKimiProvider() {
  return useApiKeyProvider({
    id: 'kimi',
    name: 'Kimi Code',
    keyPrefix: 'sk-kimi',
    fetchUsage: fetchKimiUsage,
  })
}
```

### Google Antigravity

**File**: `src/composables/use-antigravity-provider.ts`

Uses Google OAuth with custom scopes:

```typescript
const antigravity = useGoogleProvider({
  id: 'antigravity',
  name: 'Google Antigravity',
  clientId: '...',
  clientSecret: '...',
  scopes: ['openid', 'email', 'profile'],
  fetchUsage: fetchAntigravityUsage
})
```

### Gemini CLI

**File**: `src/composables/use-gemini-provider.ts`

Uses Google OAuth with different endpoint:

```typescript
const gemini = useGoogleProvider({
  id: 'gemini',
  name: 'Gemini CLI',
  clientId: '681255809395-...',
  clientSecret: '',  // PKCE flow
  scopes: ['openid', 'email', 'https://www.googleapis.com/auth/cloud-platform'],
  fetchUsage: fetchGeminiUsage
})
```

### GitHub Copilot

**File**: `src/composables/use-copilot-provider.ts`

Uses `useBaseProvider` with VS Code native authentication:

```typescript
export const useCopilotProvider = defineService(() =>
  useBaseProvider({
    id: 'copilot',
    name: 'GitHub Copilot',
    fetchUsage: async (): Promise<UsageItem[]> => {
      // 使用 VS Code 内置的 GitHub 认证获取 token
      const { authentication } = await import('vscode')
      const session = await authentication.getSession('github', ['read:user'], {
        createIfNone: false,
      })
      // ... 调用 GitHub API 获取 usage
    },
    authenticate: async () => {
      // 触发登录流程
      await authentication.getSession('github', ['read:user'], {
        createIfNone: true,
      })
      return 'github-session'
    },
  })
)
```

## Provider Usage Types

| Provider | Usage Type | Notes |
|----------|-----------|-------|
| Zhipu / Z.AI | Token / Request | Token limits + MCP quotas |
| Kimi | Percentage | Weekly usage % + rate limit details % |
| Antigravity | Percentage | By model |
| Gemini | Percentage | `remainingFraction` converted to used % |
| Copilot | Request | Premium request limits |

## Sorting

All providers sort usage items by:
1. Usage percentage ascending (more remaining = first)
2. Token limits before request limits
