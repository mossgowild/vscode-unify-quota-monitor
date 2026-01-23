# AGENTS.md

## 项目概述
`unify-quota-monitor` 是一个 VS Code 扩展，旨在使用现代化的 `reactive-vscode` 框架，在侧边栏 Panel 中实时显示多个 AI Provider（OpenAI, Google Antigravity, 智谱 AI/Zhipu AI, Z.ai）的真实用量配额。

## 目录结构
- `src/extension.ts`: 插件入口，使用 `defineExtension` 初始化并注册全局命令。
- `src/composables/`: 核心逻辑 (Composables)
    - `use-auth.ts`: 负责登录认证。处理 OAuth 流程、API Key 输入、账号增删改查。
    - `use-usage.ts`: 负责调用各平台真实 API 获取用量数据，管理自动刷新逻辑，处理并发刷新。
    - `use-accounts.ts`: 负责账号数据的持久化存储（Settings），提供账号 CRUD 操作。
    - `use-config.ts`: 定义配置项的响应式接口。
    - `use-view.ts`: 管理侧边栏 Webview Panel，负责 UI 渲染。
- `src/providers.ts`: 统一管理 Provider 的静态元数据定义。
- `src/i18n.ts`: 国际化工具，封装 `vscode.l10n`。
- `src/types.ts`: 核心类型定义。
- `l10n/`: 国际化资源文件。

## 核心业务逻辑

### 1. 响应式架构 (Reactive Architecture)
- **State Management**: 使用 Vue Reactivity API (`ref`, `computed`, `watch`) 管理状态。
- **Reactivity**: 配置项 (`config.accounts`, `config.autoRefresh`) 的变化会自动触发 UI 更新或逻辑重载。
- **Service Injection**: 使用 `defineService` 实现单例模式，确保 `useUsage` 状态在不同组件间共享。

### 2. UI 交互
- **侧边栏 Panel**: 使用 Webview View，通过 `use-view.ts` 渲染 HTML。
    - **无闪烁刷新**: 刷新数据时，旧数据保留显示，直到新数据获取成功，避免界面闪烁。
    - **原生体验**: 使用 VS Code 原生 CSS 变量，确保主题一致性。
- **QuickPick 菜单**: 用于账号管理的操作界面。

### 3. 认证与存储
- **Google OAuth**: 使用本地 HTTP 服务器（端口 51121）自动捕获授权码。
- **OpenAI OAuth**: 支持 OAuth 登录（端口 1455），支持 PKCE 流程。
- **API Key**: 支持智谱 AI 和 Z.ai 的 API Key 验证和存储。
- **存储**: 数据存储在 `unifyQuotaMonitor.accounts` 全局配置中。

### 4. 国际化 (i18n)
- **标准方案**: 采用 `vscode.l10n` 标准方案。
- **资源文件**:
    - **Manifest**: `package.nls.json` (英文/默认) 和 `package.nls.zh-cn.json` (中文)。
    - **源码**: 源码直接使用英文 Key，中文翻译位于 `l10n/bundle.l10n.zh-cn.json`。
- **全面覆盖**: 覆盖所有 UI 文本、配置项描述、命令标题。

## 架构设计原则

### 组合式函数 (Composables)
项目采用 Vue 组合式函数风格，将逻辑封装在独立的函数中：

#### useAuth
- **职责**: 处理认证流程、Token 交换、OAuth 回调。
- **交互**: 弹出 InputBox 或 QuickPick 与用户交互。

#### useUsage
- **职责**: 获取用量数据、管理刷新定时器。
- **特性**: 
    - 注入 Token 刷新器 (`injectTokenRefreshers`) 解决循环依赖。
    - 监听配置变化自动重置定时器。

#### useView
- **职责**: 生成 HTML 字符串。
- **特性**: 响应式更新，当 `providers` 数据变化时自动重新渲染 Webview。

## 开发指南

1.  **安装依赖**: `npm install`
2.  **启动调试**: `F5`
3.  **构建**: `npm run build` (使用 tsdown)
4.  **类型检查**: `npm run typecheck`

## 配置项

### unifyQuotaMonitor.accounts
- 自动管理的账号列表，包含加密/编码后的凭证。

### unifyQuotaMonitor.autoRefresh
- `enabled`: 是否启用
- `intervalMs`: 刷新间隔
