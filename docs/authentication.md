# 认证机制

## 概述

本项目支持多种认证方式，包括 OAuth（Google、OpenAI）和 VS Code 原生认证（GitHub）。所有认证逻辑由无状态的工具函数处理，位于 `src/utils/` 目录。

## Google OAuth

### 配置

- **本地端口**: 51121
- **功能**: 自动捕获授权码
- **存储**: refresh_token

### 流程

1. 生成随机 state 参数
2. 构建授权 URL（包含 access_type=offline 和 prompt=consent）
3. 使用 `env.openExternal()` 打开浏览器
4. 本地 HTTP Server 监听端口 51121
5. 自动捕获回调中的授权码
6. 使用 `exchangeGoogleCode()` 交换获取 refresh_token

### 实现细节

```typescript
// src/utils/google-auth.ts
export async function loginWithGoogle(): Promise<string> {
  const state = Math.random().toString(36).substring(7)
  const authUrl = new URL(GOOGLE_OAUTH.authUrl)
  // ... 设置参数

  await env.openExternal(Uri.parse(authUrl.toString()))

  const result = await waitForOAuthCallback(51121, '/oauth-callback', state)
  const tokens = await exchangeGoogleCode(result)

  return tokens.refresh_token
}
```

## Gemini CLI OAuth

### 配置

- **本地端口**: 51121（与 Google Antigravity 复用）
- **认证方式**: Google OAuth 2.0
- **Client ID**: `681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j`
- **存储**: accessToken + refreshToken（JSON 格式）

### 流程

1. 生成随机 state 参数
2. 构建 Google OAuth 授权 URL
3. 使用 `env.openExternal()` 打开浏览器
4. 本地 HTTP Server 监听端口 51121
5. 自动捕获回调中的授权码
6. 交换获取 access_token 和 refresh_token
7. 使用 refresh_token 自动刷新 access_token

### 用量 API

- **项目获取**: `cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`
- **配额获取**: `cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota`
- **返回格式**: `buckets[]` 数组，包含 `modelId`、`remainingFraction`、`resetTime`
- **显示方式**: 百分比（`remainingFraction` 转换为已使用百分比）

### 支持模型

| modelId | 显示名称 |
|---------|----------|
| `gemini-3-pro-preview` | Gemini 3 Pro |
| `gemini-2.5-pro` | Gemini 2.5 Pro |
| `gemini-2.0-flash` | Gemini 2.0 Flash |
| ... | ... |

## GitHub Auth

### 配置

- **认证方式**: VS Code 原生 `authentication` API
- **Scope**: `read:user`

### 实现

使用 VS Code 的 `authentication.getSession()` API：

```typescript
// src/utils/github-auth.ts
export async function getGitHubAccessToken(): Promise<string | null> {
  const session = await authentication.getSession('github', ['read:user'], { createIfNone: false })
  return session?.accessToken || null
}
```

### 配额接口

- **接口**: `copilot_internal/user`
- **Token**: 直接使用 GitHub OAuth Token (`gho_...`)
- **必需 Headers**:
  - `X-GitHub-Api-Version`: `2023-07-07`
  - `User-Agent`: `GitHubCopilotChat/0.24.0`
  - `Editor-Version`: `vscode/1.97.0`
  - `Editor-Plugin-Version`: `copilot-chat/0.24.0`
  - `Copilot-Integration-Id`: `vscode-chat`

## Token 刷新机制

### 实现

- **位置**: `src/utils/google-auth.ts` / `src/utils/gemini-auth.ts`
- **触发条件**: API 调用返回 401 状态码
- **处理流程**:
  1. `useUsage` 检测到 401 错误
  2. 自动调用 Token 刷新逻辑
  3. 更新配置中的 Token
  4. 重新发起原始请求

### 错误处理

- Token 失效时在 UI 上直接显示红色错误详情
- 网络错误时同样显示错误信息
- 支持手动重新认证

## OAuth 底层实现

### PKCE (Proof Key for Code Exchange)

- **代码挑战**: `code_challenge` = BASE64URL(SHA256(`code_verifier`))
- **用途**: 防止授权码拦截攻击
- **适用**: OpenAI OAuth

### HTTP Server 回调

- **功能**: 本地监听 OAuth 回调
- **端口**: Google/Gemini (51121)
- **处理**: 自动提取授权码并关闭服务器
- **实现位置**: `src/utils/oauth.ts`

## 数据存储

- **持久化位置**: `unifyQuotaMonitor.accounts` 全局配置
- **存储内容**: 认证 Token、账号信息、Provider 配置
- **安全性**: Token 加密存储（依赖 VS Code 的 secret storage）

## 相关文档

- [架构设计](./architecture.md) - 认证在数据流中的位置
- [UI/UX 设计](./ui-ux.md) - 认证错误提示的 UI 设计
