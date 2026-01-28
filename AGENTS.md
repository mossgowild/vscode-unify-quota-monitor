# AGENTS.md

## 项目概述

`unify-quota-monitor` 是一个 VS Code 扩展，使用 `reactive-vscode` 框架在侧边栏 Panel 中实时显示多个 AI Provider（OpenAI, Google Antigravity, GitHub Copilot, Gemini CLI, 智谱 AI/Zhipu AI, Z.ai）的真实用量配额。

## 快速开始

```bash
# 安装依赖
npm install

# 启动调试
F5

# 构建
npm run build

# 类型检查
npm run typecheck

# Lint
npx eslint
```

## 目录结构

```
src/
├── extension.ts          # 插件入口，按顺序初始化 Composables
├── types.ts              # 核心类型定义（ProviderId, UsageCategory, Account, StoredAccount）
├── providers.ts          # Provider 静态元数据定义（getProviderDefinition）
├── i18n.ts               # 国际化工具（封装 vscode.l10n）
├── composables/
│   ├── use-config.ts     # Model 层基础 - defineConfig 定义配置接口
│   ├── use-accounts.ts   # Model 层辅助 - 账号 CRUD 封装（computed, ConfigurationTarget）
│   ├── use-usage.ts      # Controller 层 - defineService，数据获取与自动刷新
│   └── use-view.ts       # View 层 - useWebviewView，HTML 生成与 UI 交互
└── utils/
    ├── auth-helpers.ts   # 认证流程（Google/OpenAI OAuth, GitHub Auth, Token 刷新）
    └── oauth-helpers.ts  # OAuth 协议底层实现（PKCE, HTTP Server 回调）
```

**初始化顺序**（extension.ts）：
```typescript
useConfig()      // 1. 定义配置接口（accounts, autoRefresh）
useAccounts()    // 2. 初始化账号 CRUD 封装
useUsage()       // 3. 启动数据服务（defineService）
useView()        // 4. 注册 Webview 视图（useWebviewView）
```

## 核心架构

**响应式 MVC + 单向数据流**，基于 `reactive-vscode` 框架：

```
View (useView) → Model (config) → Controller (useUsage) → View (useView)
用户操作 → 更新配置 → 自动刷新数据 → 重新渲染
```

### 框架 API

- **defineConfig**: 响应式配置管理（Model 层）
- **defineService**: 服务容器，单例模式（Controller 层）
- **useWebviewView**: Webview 视图管理（View 层）
- **Vue Reactivity**: `ref`, `computed`, `watchEffect` 实现自动响应
- **useCommand**: 命令注册（showAccountMenu, refresh）

### 调用约束

| 层级 | 模块 | 框架 API | 只能调用 | 职责 |
|---|---|---|---|---|
| View | `useView` | useWebviewView | `useUsage`, `config`, `utils` | HTML 模板生成、QuickPick 菜单、写入配置 |
| Controller | `useUsage` | defineService | `useAccounts`, `utils` | API 请求、watchEffect 自动刷新 |
| Model | `useAccounts` | - | `useConfig` | computed 账号列表、CRUD 封装 |
| Model | `useConfig` | defineConfig | 无 | 配置接口定义（accounts, autoRefresh） |
| Utils | `utils/` | - | 无 | OAuth 流程、PKCE、HTTP Server |

### 支持的 Provider

| ID | 名称 | 认证方式 | 存储内容 |
|---|---|---|---|
| `openai` | OpenAI | OAuth / Token | refresh_token (OAuth) 或 accessToken (JWT) |
| `google` | Google Antigravity | OAuth | refresh_token (端口 51121) |
| `gemini-cli` | Gemini CLI | OAuth | accessToken + refresh_token (端口 51121) |
| `zhipu` | Zhipu AI | API Key | API Key |
| `zai` | Z.ai | API Key | API Key |
| `github` | GitHub Copilot | OAuth | VS Code authentication.getSession() |

### 核心特性

- **自动响应式**: `config` 变化触发 `watchEffect` 重新计算，自动刷新数据
- **防抖优化**: `useUsage` 实现防抖，避免频繁配置变化导致过多 API 请求
- **无状态工具函数**: 认证逻辑由无状态函数处理（`loginWithGoogle`, `loginWithOpenAI`, `loginWithGeminiCli`, `loginWithGitHub`）
- **服务单例**: `defineService` 确保 `useUsage` 全局唯一实例

### Provider 用量类型

| Provider | 用量类型 | 说明 |
|---|---|---|
| OpenAI | Token / Request | 双窗口配额（primary/secondary window） |
| Google Antigravity | Percentage | 按模型显示剩余百分比 |
| **Gemini CLI** | **Percentage** | API 返回 `remainingFraction` (0.0-1.0)，显示为已使用百分比 |
| Zhipu AI / Z.ai | Token / Request | Token 限额 + MCP 配额 |
| GitHub Copilot | Request | Premium Request 限额 |

**Gemini CLI 特殊处理**:
- API 返回 `buckets[]` 数组，每个 bucket 包含 `modelId`, `remainingFraction`, `resetTime`
- `remainingFraction` 是**剩余比例**（0.0-1.0），不是具体请求次数
- 显示为已使用百分比: `(1 - remainingFraction) * 100`
- 支持 20+ 模型映射（`gemini-3-pro-preview` → "Gemini 3 Pro"）

### 数据流示例

```typescript
// 用户添加账号
view.showAccountMenu() → loginWithGoogle() → config.update('accounts', [...])

// 自动响应
config.accounts 变化 → watchEffect 触发 → useUsage.fetchAllUsage() → providers 更新 → html 重新计算

// 自动刷新
setInterval(intervalMs) → usage.refresh() → 重新获取所有账号用量
```

## 构建系统

项目使用 **Vite** 进行构建和开发，配置位于 `vite.config.ts`。

- **构建工具**: Vite (Library Mode)
- **输出格式**: CommonJS (`dist/extension.cjs`)
- **运行环境**: Node.js 22 (VS Code 扩展宿主环境)
- **开发模式**: `npm run dev` 使用 Vite Watch 模式实时编译

## 详细文档

- 📐 [架构设计](./docs/architecture.md) - MVC 模式、数据流、响应式系统详解
- 🎨 [UI/UX 设计](./docs/ui-ux.md) - 完整样式规范、布局系统、交互设计
- 🔐 [认证机制](./docs/authentication.md) - OAuth 流程、Token 管理、存储安全
- 📜 [设计历史](./docs/design-history.md) - UI/UX 演进记录和变更说明

## 代码规则

- **单向数据流**: 严禁下层模块调用上层模块（如 `useUsage` 不可调用 `useView`）
- **工具函数分离**: 纯逻辑、无状态的代码放入 `src/utils/`
- **WatchEffect**: 优先使用 `watchEffect` 处理响应式依赖，避免配置 Proxy 对象的深度遍历

## 维护指南

- **配置默认值同步**: 修改配置的默认值时，必须同时更新 `package.json` 中的 `configuration` 默认值和 `src/composables/use-config.ts` 中的常量定义，确保两者一致。
