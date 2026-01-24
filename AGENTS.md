# AGENTS.md

## 项目概述
`unify-quota-monitor` 是一个 VS Code 扩展，旨在使用现代化的 `reactive-vscode` 框架，在侧边栏 Panel 中实时显示多个 AI Provider（OpenAI, Google Antigravity, 智谱 AI/Zhipu AI, Z.ai）的真实用量配额。

## 目录结构
- `src/extension.ts`: 插件入口，按顺序初始化 Composables 并注册全局命令。
- `src/composables/`: 响应式逻辑核心
    - `use-view.ts`: **View 层**。负责所有 UI 交互（Webview 渲染、QuickPick 菜单、InputBox），直接读取 `useUsage` 数据，直接写入 `config`。
    - `use-usage.ts`: **Controller 层**。负责获取用量数据、自动刷新。通过 `watchEffect` 监听 `config` 变化自动更新。
    - `use-accounts.ts`: **Model 层辅助**。提供账号数据的 CRUD 封装，操作 `config`。
    - `use-config.ts`: **Model 层基础**。定义配置项的响应式接口。
- `src/utils/`: 纯工具函数
    - `auth-helpers.ts`: 负责认证流程（Google/OpenAI OAuth, API Key）和 Token 刷新。
    - `oauth-helpers.ts`: OAuth 协议底层实现（PKCE, HTTP Server 回调）。
- `src/providers.ts`: 统一管理 Provider 的静态元数据定义。
- `src/i18n.ts`: 国际化工具，封装 `vscode.l10n`。
- `src/types.ts`: 核心类型定义。

## 架构设计 (响应式 MVC & 单向数据流)

本项目采用严格的**单向数据流**架构，遵循 MVC 模式，利用 Vue Reactivity System 实现自动响应。

### 数据流向
1.  **View (useView)**: 用户操作 -> 调用工具函数获取凭证 -> 直接更新 `config` (Model)。
2.  **Model (config)**: 配置数据发生变化 (Reactivity)。
3.  **Controller (useUsage)**: `watchEffect` 监听到 `config` 变化 -> 自动重新计算/拉取数据 -> 更新 `providers` (Computed)。
4.  **View (useView)**: `html` (Computed) 依赖 `providers` -> 自动重新渲染 Webview。

### 调用约束 (Strict Dependency Rules)
| 模块 | 只能调用 | 职责 |
|---|---|---|
| **useView** | `useUsage`, `config`, `utils` | UI 渲染、用户交互、写入配置 |
| **useUsage** | `useAccounts`, `utils` | 数据获取、自动刷新逻辑 |
| **useAccounts** | `useConfig` | 账号数据读取、CRUD 封装 |
| **useConfig** | 无 | 配置定义 |
| **utils/** | 无 | 纯逻辑工具函数 (Auth, OAuth) |

*注：`useAuth` 已被移除，认证逻辑由无状态的工具函数处理。*

## 核心业务逻辑

### 1. 响应式架构
- **State Management**: 使用 Vue Reactivity API (`ref`, `computed`, `watchEffect`)。
- **Reactivity**: 任何配置项 (`accounts`, `autoRefresh`) 的变化都会自动触发数据刷新和 UI 重绘，无需手动调用 `refresh`。
- **Debounce**: `useUsage` 中实现了防抖逻辑，避免配置频繁变化导致过多请求。

### 2. 数据处理与展示逻辑
- **Reset Time**:
    - 剩余时间 > 1 小时：仅显示时分 (e.g. `2h 30m`)。
    - 剩余时间 < 1 小时：显示分秒 (e.g. `59m 30s`)。
    - 前端定时器 (`setInterval`) 每秒实时更新倒计时。
- **排序规则**:
    - Z.ai/Zhipu: Token Limit 类型的配额始终排在 Request Limit 之前。
    - Google Provider: "Claude Opus 4.5" 优先显示。
- **UI 样式规范**:
    - **用量数值**与**Reset 时间**样式统一：字体大小 `0.85em`，颜色 `descriptionForeground`，透明度 `0.8`。
    - Reset 时间居左对齐。
    - Request 类型的配额不显示单位后缀 ("requests")。

### 3. UI 交互
- **侧边栏 Panel**: 使用 Webview View，由 `use-view.ts` 管理。
    - **无闪烁刷新**: 数据刷新时旧数据保留，直到新数据就绪。
- **账号管理 QuickPick**:
    - Label: 显示 Provider 名称 (e.g., "Google Antigravity")。
    - Description: 显示账号 Alias 或 ID。
- **认证与存储**:
    - 数据持久化在 `unifyQuotaMonitor.accounts` 全局配置中。
    - `ProviderDefinition` 不再包含 `icon` 和 `helpUrl` (已移除未使用的字段)。

### 4. 认证与存储 (底层)
- **Google OAuth**: 本地端口 51121，自动捕获授权码。
- **OpenAI OAuth**: 本地端口 1455，支持 PKCE。
- **Token 刷新**: 在 `auth-helpers.ts` 中实现，`useUsage` 在 API 调用返回 401 时自动尝试刷新。

## 开发指南

1.  **安装依赖**: `npm install`
2.  **启动调试**: `F5`
3.  **构建**: `npm run build` (使用 tsdown)
4.  **类型检查**: `npm run typecheck`
5.  **Lint**: `npm run lint` (虽然未定义脚本，但应使用 `npx eslint`)

## 代码规则
- **单向数据流**: 严禁下层模块调用上层模块（如 `useUsage` 不可调用 `useView`）。
- **工具函数分离**: 纯逻辑、无状态的代码应放入 `src/utils/`。
- **WatchEffect**: 优先使用 `watchEffect` 处理响应式依赖，避免配置 Proxy 对象的深度遍历问题。
