# AGENTS.md

## 项目概述
`unify-quota-monitor` 是一个 VS Code扩展，旨在侧边栏 Panel 中实时显示多个 AI Provider（OpenAI, Google Antigravity, 智谱 AI/Zhipu AI, Z.ai）的真实用量配额。

## 目录结构
- `src/extension.ts`: 插件入口，初始化 Managers 并注册全局命令。
- `src/managers/`: 核心业务逻辑
    - `AuthManager.ts`: 负责登录认证。支持 Google OAuth 自动化流程、手动 Token 输入。
    - `UsageManager.ts`: 负责调用各平台真实 API 获取用量数据（OpenAI JWT, Google Cloud Quota 等），并支持自动刷新。
- `src/ui/`: UI 组件
    - `UsageViewProvider.ts`: 侧边栏 Webview Panel，展示所有 Provider 的用量详情。
- `src/utils/`: 工具函数
    - `config.ts`: 配置读写工具函数，直接使用 `vscode.workspace.getConfiguration` 读写配置。
    - `providers.ts`: 统一管理 Provider 的静态元数据定义。
- `src/types.ts`: 包含 `ProviderId`、`Provider`、`Account`、`StoredAccount` 和 `AutoRefreshConfig` 等核心类型定义。

## 核心业务逻辑

### 1. UI 交互
- **侧边栏 Panel**: 在侧边栏提供美观的用量监控界面，标题为 "Quota"。
    - **工具栏按钮**: 使用 VS Code 原生工具栏按钮（右上角）
        - `$(plus)` 添加账号按钮
        - `$(refresh)` 刷新用量按钮
    - **进度条**: 刷新时使用 `vscode.window.withProgress` API 在 Panel 顶部显示原生进度条
    - Provider 名称显示一次，不带图标和账号计数
    - **单账号**: 不显示账号标签
    - **多账号**: 显示每个账号的别名或 ID
    - 刷新按钮有 UI 反馈（进度条显示）
    - **空状态 (Empty State)**:
        - 设计风格：简洁单色风格，避免使用 Emoji。
        - 图标：使用 SVG 柱状图图标 (60x60px, stroke-width: 1)，颜色使用 `editor-foreground`，无透明度。
        - 标题：使用 `editor-foreground` 颜色，1.6em 大小，字重 500。
        - 描述：使用 `descriptionForeground` 颜色，1em 大小，限制宽度并居中，提示"点击右上角图标按钮管理账号"。
        - 交互：禁止文本选择 (`user-select: none`, `cursor: default`)。

### 2. 认证与存储
- **Google OAuth**: 使用本地 HTTP 服务器（端口 51121）自动捕获授权码，失败时支持手动粘贴重定向 URL。
- **OpenAI OAuth**: 支持 OAuth 登录（推荐）和手动 Token 输入。OAuth 流程使用本地端口 1455，支持 PKCE 流程。
- **Settings 存储**: 账号数据存储在 `unifyQuota.accounts` 配置项中（数组格式）。
- **账号别名**: 支持为账号设置别名，方便识别和管理。
- **自动刷新 Token**: Google Antigravity 和 OpenAI (OAuth) 支持 Access Token 过期后自动刷新。

### 3. 多账号支持
- 每个 Provider 可以有多个账号
- 账号存储在 `unifyQuota.accounts` 数组中
- 每个账号包含：`id`、`providerId`、`alias`（可选）、`credential` (Token 字符串或 JSON 凭证)

### 4. 自动刷新
- 默认每 1 分钟自动刷新用量数据
- 首次加载自动刷新，无需手动点击
- 可通过 `unifyQuota.autoRefresh` 配置项自定义
- 支持启用/禁用自动刷新
- 防止并发刷新导致的重复显示

### 5. 数据处理
- **单位换算**: Token 类配额统一以 `M` (百万) 为单位精简显示。
- **倒计时**: 自动计算并显示易读的重置剩余时间（如 `4h25m`）。
- **百分比优先**: 进度条视觉化，百分比数值清晰显示。

### 6. 国际化
- 所有 UI 文本支持中英文
- 自动跟随 VS Code 的语言设置（`vscode.env.language`）
- Provider 名称、账号标签、按钮文本、提示信息全部国际化

## QuickPick 菜单

### 一级菜单（标题：Manage Accounts / 管理账号）
- **区域1**: 已登录账号列表
  - 每个账号格式：`Provider名称 - 别名/ID`（无图标）
  - 点击账号 → 进入二级菜单
- **区域2**: 分割线
- **区域3**: 添加按钮
  - `$(plus) 添加 Provider` - 选择 Provider 并登录

### 二级菜单
- `$(arrow-left) 返回` / `Back`
- `$(pencil) 设置别名` / `Set Alias` - 修改账号别名
- `$(sign-in) 重新登录` / `Relogin` - 更新认证凭证
- `$(sign-out) 退出登录` / `Logout` - 删除账号

## 类型系统

### StoredAccount
```typescript
interface StoredAccount {
    id: string;        // 账号唯一标识
    providerId: ProviderId;  // 所属 Provider
    alias?: string;     // 账号别名（可选）
    credential: string;  // 认证凭证
}
```

### Account
```typescript
interface Account {
    id: string;        // 账号唯一标识
    alias?: string;     // 账号别名（可选）
    credential: string;  // 认证凭证
    usage: UsageCategory[];  // 用量数据
    lastUpdated: string;  // 最后更新时间
}
```

注意：通过 `credential` 字段判断账号是否已登录（`credential !== ''`）

### AutoRefreshConfig
```typescript
interface AutoRefreshConfig {
    enabled: boolean;  // 是否启用自动刷新
    intervalMs: number;  // 刷新间隔（毫秒）
}
```

## 配置项

### unifyQuota.accounts
- 类型: `Array<StoredAccount>`
- 默认值: `[]`
- 描述: 存储所有已登录账号（由扩展自动管理）

### unifyQuota.autoRefresh
- 类型: `Object`
- 默认值: `{ enabled: true, intervalMs: 60000 }`
- 描述: 自动刷新配置

## 编码规范
- **Icons**: 使用 Codicons (`$(plus)`, `$(arrow-left)`, `$(pencil)` 等)；大尺寸展示（如空状态）推荐使用 SVG。
- **UI Colors**: 严格遵循 VS Code 主题变量 (如 `var(--vscode-editor-foreground)`, `var(--vscode-descriptionForeground)`)。
- **Type Safety**: 严格使用 `ProviderId` 枚举，避免硬编码字符串。
- **存储**: 使用 `src/utils/config.ts` 中的工具函数读写配置。
- **国际化**: 使用 `vscode.env.language` 判断语言，支持中英文。
- **ESLint**: 强制执行 `@typescript-eslint/no-unused-vars` 规则，移除未使用的变量和导入。对于接口必需但未使用的参数，使用 `eslint-disable-next-line` 注释。

## 工作流程
1.  **安装**: `npm install`
2.  **调试**: `F5` 启动扩展开发宿主。
3.  **验证**: 在 `settings.json` 中检查 `unifyQuota.accounts` 的写入情况，或在 Panel 中执行登录操作。
4.  **编译**: `npm run compile`
5.  **Lint**: `npm run lint`

## 命令

- `unifyQuota.manageAccounts`: 打开账号管理 QuickPick 菜单（图标：`$(plus)`）
- `unifyQuota.refresh`: 刷新所有用量数据（图标：`$(refresh)`）

## 架构设计

### 移除的内容
- ❌ `SecretStore.ts` - 已删除
- ❌ `Account.loggedIn` - 通过 `credential` 推导
- ❌ `login` / `logout` 命令 - 被 `manageAccounts` 替代
- ❌ "从 OpenCode 导入" 功能 - 已移除
- ❌ Provider 图标显示 - QuickPick 和 Panel 中都不显示图标

### 新增的内容
- ✅ `src/utils/config.ts` - 配置读写工具函数
- ✅ `src/utils/providers.ts` - 统一 Provider 定义
- ✅ `AutoRefreshConfig` - 自动刷新配置类型
- ✅ `Account` 和 `StoredAccount` - 多账号类型定义（包含 alias 字段）
- ✅ `UsageManager.startAutoRefresh()` - 启动自动刷新
- ✅ `UsageManager.stopAutoRefresh()` - 停止自动刷新
- ✅ `AuthManager.setAccountAlias()` - 设置账号别名
- ✅ `UsageManager.onDidRefreshStateChange` - 刷新状态变化事件
- ✅ 国际化支持 - 所有 UI 文本支持中英文
- ✅ OpenAI OAuth - 支持 ChatGPT Plus/Pro OAuth 登录
- ✅ Token 自动刷新 - 支持 Google Antigravity 和 OpenAI OAuth Token 自动刷新
- ✅ VS Code 原生进度条 - 使用 `vscode.window.withProgress` API 显示刷新进度

### 修改的内容
- 📝 `Provider` - `models` 字段改为 `accounts`
- 📝 `Provider.auth` - 增加 `loggedIn` 字段（用于初始化）
- 📝 `package.json` - 视图名称改为 "Quota"，配置项结构调整；**添加工具栏按钮配置（`menus.view/title`）**
- 📝 `extension.ts` - 移除 `SecretStore.init`，添加 `manageAccounts` 和 `refresh` 命令，启动 auto-refresh，首次加载自动刷新
- 📝 `AuthManager.ts` - 使用 `config.ts` 工具函数，添加 setAccountAlias 方法，完整国际化；**更新 Google OAuth 配置，添加 OpenAI OAuth 支持**
- 📝 `UsageManager.ts` - 添加 auto-refresh，使用 `config.ts` 工具函数，添加并发刷新锁，完整国际化；**更新 Google API 用量获取逻辑，添加 OpenAI Token 刷新逻辑；使用 `vscode.window.withProgress` API 显示刷新进度**
- 📝 `UsageViewProvider.ts` - 移除账号计数显示，修改账号标签格式，单账号时不显示账号标签；**移除底部按钮，移除自定义进度条，使用 VS Code 原生工具栏按钮和进度条**
