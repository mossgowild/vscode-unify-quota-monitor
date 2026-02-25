# Authentication

## Overview

| Provider | Auth Type | Credential Stored |
|----------|-----------|-------------------|
| Zhipu AI | API Key | API Key |
| Z.AI | API Key | API Key |
| Kimi Code | API Key | API Key |
| Google Antigravity | OAuth | refresh_token |
| Gemini CLI | OAuth | accessToken + refresh_token (JSON) |
| GitHub Copilot | VS Code Auth | Session reference |

## API Key Authentication

**Composables**: `useApiKeyProvider` → individual providers

### Flow

1. Show input box with prefix validation
2. Validate API key format
3. Store in config

```typescript
const authenticate = async () => {
  const apiKey = await window.showInputBox({
    prompt: 'Enter your API Key',
    validateInput: (value) =>
      value.startsWith(prefix) ? null : `Must start with "${prefix}"`
  })
  return apiKey
}
```

### Prefixes

| Provider | Prefix |
|----------|--------|
| Zhipu / Z.AI | `sk-` |
| Kimi | `sk-kimi` |

## OAuth Authentication

**Composables**: `useOAuthProvider` → `useGoogleProvider` → individual providers

### Google OAuth Flow

**Port**: 51121 (shared by Antigravity and Gemini)

```typescript
const authenticate = async () => {
  const state = Math.random().toString(36).substring(7)
  const authUrl = buildAuthUrl(state)
  
  await env.openExternal(Uri.parse(authUrl))
  
  const code = await waitForOAuthCallback(51121, '/oauth-callback', state)
  const tokens = await exchangeCodeForTokens(code)
  
  return tokens.refresh_token
}
```

### Token Refresh (Google)

Automatic refresh on 401:

```typescript
const requestWithRetry = async (url, options, credentialData) => {
  try {
    return await request()
  } catch (error) {
    if (error.status === 401) {
      const newToken = await refreshAccessToken(credentialData.refreshToken)
      credentialData.accessToken = newToken
      await onCredentialChange(JSON.stringify(credentialData))
      return await request()
    }
    throw error
  }
}
```

### VS Code Native Auth (Copilot)

Uses VS Code's `authentication` API:

```typescript
const authenticate = async () => {
  await authentication.getSession('github', ['read:user'], {
    createIfNone: true
  })
  return 'vscode-github-session'
}
```

## Storage

All credentials stored in VS Code global settings:

```json
{
  "unifyQuotaMonitor.providers": {
    "zhipu": [{ "credential": "sk-...", "name": "Work" }],
    "antigravity": [{ "credential": "1//...", "name": "Personal" }]
  }
}
```

### Credential Update

When tokens are refreshed:

```
Provider → onCredentialChange → config.providers updated → UI refreshes
```


- [Architecture Design](./architecture.md) - Authentication's role in data flow
- [UI/UX Design](./ui-ux.md) - UI design for authentication error messages
