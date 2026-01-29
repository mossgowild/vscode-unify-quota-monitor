# 架构设计

## 响应式 MVC & 单向数据流

本项目采用严格的**单向数据流**架构，遵循 MVC 模式，基于 `reactive-vscode` 框架和 Vue Reactivity System 实现自动响应。

### 数据流向

1.  **View (useView)**: 用户操作 → 调用工具函数获取凭证 → 调用 `useAccounts` 更新配置 (Model)
2.  **Model (config)**: 配置数据发生变化 (Reactivity)
3.  **Controller (useUsage)**: `watchEffect` 监听到 `config` 变化 → 自动重新计算/拉取数据 → 更新 `providers` (Computed)
4.  **View (useView)**: `html` (Computed) 依赖 `providers` → 自动重新渲染 Webview

### 调用约束 (Strict Dependency Rules)

| 模块 | 只能调用 | 职责 |
|---|---|---|
| **useView** | `useUsage`, `config`, `utils` | UI 渲染、用户交互、写入配置 |
| **useUsage** | `useAccounts`, `utils` | 数据获取、自动刷新逻辑 |
| **useAccounts** | `useConfig` | 账号数据读取、CRUD 封装 |
| **useConfig** | 无 | 配置定义 |
| **utils/** | 无 | 纯逻辑工具函数 (Auth, OAuth) |

> **注**: `useAuth` 已被移除，认证逻辑由无状态的工具函数处理。

### 响应式架构特性

#### 框架 API 使用

- **defineConfig**: 在 `use-config.ts` 中定义配置接口
  ```typescript
  export const config = defineConfig<Config>('unifyQuotaMonitor')
  ```

- **defineService**: 在 `use-usage.ts` 中创建单例服务
  ```typescript
  export const useUsage = defineService(() => {
    // 服务实现
  })
  ```

- **useWebviewView**: 在 `use-view.ts` 中管理 Webview
  ```typescript
  const html = computed(() => `...`)
  useWebviewView('unifyQuotaMonitor.usageView', { html })
  ```

#### 响应式实现

- **State Management**: 使用 Vue Reactivity API (`ref`, `computed`, `watchEffect`)
  - `ref`: 响应式状态（providers, isRefreshing, hasLoadedOnce）
  - `computed`: 派生状态（accounts, html）
  - `watchEffect`: 自动响应配置变化

- **Reactivity**: 任何配置项 (`providers`, `autoRefresh`) 的变化都会自动触发数据刷新和 UI 重绘，无需手动调用 `refresh`
  ```typescript
  // use-usage.ts 中
  watchEffect(() => {
    // config.providers 或 config.autoRefresh 变化时自动执行
    fetchAllUsage()
  })
  ```

- **Debounce**: `useUsage` 中实现了防抖逻辑，避免配置频繁变化导致过多请求

### 代码规则

- **单向数据流**: 严禁下层模块调用上层模块（如 `useUsage` 不可调用 `useView`）
- **工具函数分离**: 纯逻辑、无状态的代码应放入 `src/utils/`
- **WatchEffect**: 优先使用 `watchEffect` 处理响应式依赖，避免配置 Proxy 对象的深度遍历问题

### 相关文档

- [UI/UX 设计规范](./ui-ux.md) - 界面样式和交互设计
- [认证机制](./authentication.md) - OAuth 和 Token 管理
