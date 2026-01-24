# AGENTS.md

## 项目概述
`unify-quota-monitor` 是一个 VS Code 扩展，旨在使用现代化的 `reactive-vscode` 框架，在侧边栏 Panel 中实时显示多个 AI Provider（OpenAI, Google Antigravity, GitHub Copilot, 智谱 AI/Zhipu AI, Z.ai）的真实用量配额。

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
    - **设计参考**: UI 样式参考 GitHub Copilot Status Bar 的设计规范，确保视觉一致性。
    - **进度条样式**:
        - 高度: `4px`
        - 圆角: `4px`
        - 边框: `1px solid var(--vscode-gauge-border)`
        - 背景色: `var(--vscode-gauge-background)` (30% 透明度)
        - 填充色:
            - 正常: `var(--vscode-gauge-foreground)`
            - 警告 (≥75%): `var(--vscode-gauge-warningForeground)`
            - 错误 (≥90%): `var(--vscode-gauge-errorForeground)`
        - 上下边距: `2px 0`
    - **文字样式**:
        - Provider 标题: 字重 `600`，颜色 `var(--vscode-descriptionForeground)`，下边距 `0.8em`
        - 用量数值: 字体大小 `0.85em`，颜色 `var(--vscode-descriptionForeground)`，透明度 `0.8`
        - Reset 时间: 字体大小 `0.85em`，颜色 `var(--vscode-descriptionForeground)`，透明度 `0.8`，居左对齐
    - **布局与间距**:
        - Content 内边距: `0.5em 1em` (上下 0.5em，左右 1em)
        - Provider Section: 上下外边距 `0.6em`，下内边距 `0.8em`，底部分割线 `1px solid var(--vscode-panel-border)`
        - Account Block: 上外边距 `1.2em`，下外边距 `0.6em` (紧跟 Provider Header 时为 `0.8em`)
        - Usage Grid: 列宽 `minmax(12em, 1fr)` (使用相对单位)，行间距 `0.2em`，列间距 `1em`
        - Usage Item: 无内边距 (`padding: 0`)
    - **容器样式**:
        - 移除账号块的背景色和边框，使用透明背景（与 Copilot 一致）
        - 无额外圆角和装饰，保持简洁风格
    - **响应式设计**:
        - 使用相对单位 (`em`, `%`) 而非绝对像素 (`px`)，确保在不同字体大小下的一致性
        - Grid 布局自动适应容器宽度
    - **主题适配**: 所有颜色使用 VS Code 主题变量，自动适配深色/浅色/高对比度主题
    - **Request 类型的配额**: 不显示单位后缀 ("requests")。

### 3. UI 交互
- **侧边栏 Panel**: 使用 Webview View，由 `use-view.ts` 管理。
    - **无闪烁刷新**: 数据刷新时旧数据保留，直到新数据就绪。
- **账号管理 QuickPick**:
    - Label: 显示 Provider 名称 (e.g., "Google Antigravity")。
    - Description: 显示账号 Alias 或 ID。
- **认证与存储**:
    - 数据持久化在 `unifyQuotaMonitor.accounts` 全局配置中。
    - `ProviderDefinition` 不再包含 `icon` 和 `helpUrl` (已移除未使用的字段)。
    - **UI 错误提示**: `Account` 支持 `error` 字段，当 API 调用失败时（如 Token 失效或网络错误），在 UI 上直接显示红色错误详情。

### 4. 认证与存储 (底层)
- **Google OAuth**: 本地端口 51121，自动捕获授权码。
- **OpenAI OAuth**: 本地端口 1455，支持 PKCE。
- **GitHub Auth**: 使用 VS Code 原生 `authentication` API (Scope: `read:user`)。
    - 配额接口 (`copilot_internal/user`) 直接使用 GitHub OAuth Token (`gho_...`)，需配合 `X-GitHub-Api-Version` 和特定 User-Agent。
    - Copilot Chat 接口需使用 `copilot_internal/v2/token` 交换得到的 Session Token (`tid=...`)。
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

## 样式设计历史

### 2026-01-24: GitHub Copilot Status Bar UI 对齐
- **目标**: 参考 GitHub Copilot Chat 项目的 Status Bar Item UI，统一样式风格
- **主要变更**:
    1. **进度条样式升级**:
       - 圆角从 `2px` 统一为 `4px`
       - 新增 `1px solid var(--vscode-gauge-border)` 边框
       - 背景色从 `var(--vscode-scrollbarSlider-background)` 改为 `var(--vscode-gauge-background)`
       - 填充色从 `charts-*` 变量改为 `gauge-*` 变量 (foreground/warningForeground/errorForeground)
    2. **文字与布局优化**:
       - Provider Header 颜色改为 `var(--vscode-descriptionForeground)`，下边距 `0.8em`
       - 移除 Account Block 背景色和边框，采用透明设计
       - Provider Section 使用相对单位 `em` (如 `12em` 列宽) 提升响应式表现
       - Usage Grid 间距从 `0.6em` 增加到 `1em`
    3. **间距精细化**:
       - Content 上下内边距 `0.5em`
       - Provider Section 上外边距 `8px`，下外边距 `8px`，下内边距 `6px`
       - Account Block 上外边距 `1.2em`（紧跟 Header 时 `0.8em`），下外边距 `0.6em`
       - 进度条上下边距 `2px`
- **设计原则**: 简洁、主题感知、响应式、与 Copilot 一致

### 2026-01-24 (后续): 间距优化
- **目标**: 进一步优化间距，使用相对单位提升一致性
- **主要变更**:
    1. **Provider Section 间距调整**:
       - 上下外边距从 `8px` 改为 `0.6em`（统一使用相对单位）
       - 下内边距从 `6px` 改为 `0.8em`（更协调的间距比例）
    2. **Usage Grid 间距精细化**:
       - 从单一间距 `1em` 改为双值间距 `0.2em 1em`
       - 行间距 `0.2em` 使垂直方向更紧凑
       - 列间距 `1em` 保持水平方向的清晰分隔
- **优化效果**: 提升响应式表现，间距在不同字体大小下保持一致比例
