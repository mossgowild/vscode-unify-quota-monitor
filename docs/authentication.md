# Authentication Mechanism

## Overview

This project supports multiple authentication methods, including OAuth (Google, OpenAI) and VS Code native authentication (GitHub). All authentication logic is handled by stateless utility functions located in the `src/utils/` directory.

## Google OAuth

### Configuration

- **Local Port**: 51121
- **Function**: Automatically capture authorization code
- **Storage**: refresh_token

### Flow

1. Generate random state parameter
2. Build authorization URL (including access_type=offline and prompt=consent)
3. Use `env.openExternal()` to open browser
4. Local HTTP Server listens on port 51121
5. Automatically capture authorization code from callback
6. Use `exchangeGoogleCode()` to exchange for refresh_token

### Implementation Details

```typescript
// src/utils/google-auth.ts
export async function loginWithGoogle(): Promise<string> {
  const state = Math.random().toString(36).substring(7)
  const authUrl = new URL(GOOGLE_OAUTH.authUrl)
  // ... Set parameters

  await env.openExternal(Uri.parse(authUrl.toString()))

  const result = await waitForOAuthCallback(51121, '/oauth-callback', state)
  const tokens = await exchangeGoogleCode(result)

  return tokens.refresh_token
}
```

## Gemini CLI OAuth

### Configuration

- **Local Port**: 51121 (shared with Google Antigravity)
- **Authentication Method**: Google OAuth 2.0
- **Client ID**: `681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j`
- **Storage**: accessToken + refreshToken (JSON format)

### Flow

1. Generate random state parameter
2. Build Google OAuth authorization URL
3. Use `env.openExternal()` to open browser
4. Local HTTP Server listens on port 51121
5. Automatically capture authorization code from callback
6. Exchange for access_token and refresh_token
7. Use refresh_token to automatically refresh access_token

### Usage API

- **Project Fetch**: `cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`
- **Quota Fetch**: `cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota`
- **Return Format**: `buckets[]` array, containing `modelId`, `remainingFraction`, `resetTime`
- **Display Method**: Percentage (convert `remainingFraction` to used percentage)

### Supported Models

| modelId | Display Name |
|---------|--------------|
| `gemini-3-pro-preview` | Gemini 3 Pro |
| `gemini-2.5-pro` | Gemini 2.5 Pro |
| `gemini-2.0-flash` | Gemini 2.0 Flash |
| ... | ... |

## GitHub Auth

### Configuration

- **Authentication Method**: VS Code native `authentication` API
- **Scope**: `read:user`

### Implementation

Use VS Code's `authentication.getSession()` API:

```typescript
// src/utils/github-auth.ts
export async function getGitHubAccessToken(): Promise<string | null> {
  const session = await authentication.getSession('github', ['read:user'], { createIfNone: false })
  return session?.accessToken || null
}
```

### Quota Endpoint

- **Endpoint**: `copilot_internal/user`
- **Token**: Direct use of GitHub OAuth Token (`gho_...`)
- **Required Headers**:
  - `X-GitHub-Api-Version`: `2023-07-07`
  - `User-Agent`: `GitHubCopilotChat/0.24.0`
  - `Editor-Version`: `vscode/1.97.0`
  - `Editor-Plugin-Version`: `copilot-chat/0.24.0`
  - `Copilot-Integration-Id`: `vscode-chat`

## Token Refresh Mechanism

### Implementation

- **Location**: `src/utils/google-auth.ts` / `src/utils/gemini-auth.ts`
- **Trigger Condition**: API call returns 401 status code
- **Handling Process**:
  1. `useUsage` detects 401 error
  2. Automatically call token refresh logic
  3. Update Token in configuration
  4. Retry original request

### Error Handling

- When Token expires, red error details are displayed directly in the UI
- Network errors also display error messages
- Support manual re-authentication

## OAuth Underlying Implementation

### PKCE (Proof Key for Code Exchange)

- **Code Challenge**: `code_challenge` = BASE64URL(SHA256(`code_verifier`))
- **Purpose**: Prevent authorization code interception attacks
- **Applicable**: OpenAI OAuth

### HTTP Server Callback

- **Function**: Locally listen for OAuth callback
- **Port**: Google/Gemini (51121)
- **Handling**: Automatically extract authorization code and close server
- **Implementation Location**: `src/utils/oauth.ts`

## Data Storage

- **Persistence Location**: `unifyQuotaMonitor.accounts` global configuration
- **Stored Content**: Authentication Token, account information, Provider configuration
- **Security**: Token encrypted storage (relies on VS Code's secret storage)

## Related Documentation

- [Architecture Design](./architecture.md) - Authentication's role in data flow
- [UI/UX Design](./ui-ux.md) - UI design for authentication error messages
