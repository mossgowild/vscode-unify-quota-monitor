# Architecture Design

## Reactive MVC & Unidirectional Data Flow

This project adopts a strict **unidirectional data flow** architecture, following the MVC pattern, based on the `reactive-vscode` framework and Vue Reactivity System for automatic reactivity.

### Data Flow

1.  **View (useView)**: User operation → Call utility function to get credentials → Call `useAccounts` to update configuration (Model)
2.  **Model (config)**: Configuration data changes (Reactivity)
3.  **Controller (useUsage)**: `watchEffect` detects `config` changes → Automatically recalculate/fetch data → Update `providers` (Computed)
4.  **View (useView)**: `html` (Computed) depends on `providers` → Automatically re-render Webview

### Call Constraints (Strict Dependency Rules)

| Module | Can Only Call | Responsibilities |
|---|---|---|
| **useView** | `useUsage`, `config`, `utils` | UI rendering, user interaction, write configuration |
| **useUsage** | `useAccounts`, `utils` | Data fetching, auto-refresh logic |
| **useAccounts** | `useConfig` | Account data reading, CRUD wrapper |
| **useConfig** | None | Configuration definition |
| **utils/** | None | Pure logic utility functions (Auth, OAuth) |

> **Note**: `useAuth` has been removed, authentication logic is handled by stateless utility functions.

### Reactive Architecture Features

#### Framework API Usage

- **defineConfig**: Define configuration interface in `use-config.ts`
  ```typescript
  export const config = defineConfig<Config>('unifyQuotaMonitor')
  ```

- **defineService**: Create singleton service in `use-usage.ts`
  ```typescript
  export const useUsage = defineService(() => {
    // Service implementation
  })
  ```

- **useWebviewView**: Manage Webview in `use-view.ts`
  ```typescript
  const html = computed(() => `...`)
  useWebviewView('unifyQuotaMonitor.usageView', { html })
  ```

#### Reactive Implementation

- **State Management**: Use Vue Reactivity API (`ref`, `computed`, `watchEffect`)
  - `ref`: Reactive state (providers, isRefreshing, hasLoadedOnce)
  - `computed`: Derived state (accounts, html)
  - `watchEffect`: Automatically respond to configuration changes

- **Reactivity**: Any configuration item (`providers`, `autoRefresh`) changes will automatically trigger data refresh and UI redraw, no need to manually call `refresh`
  ```typescript
  // In use-usage.ts
  watchEffect(() => {
    // Automatically execute when config.providers or config.autoRefresh changes
    fetchAllUsage()
  })
  ```

- **Debounce**: `useUsage` implements debounce logic to avoid excessive requests from frequent configuration changes

## Usage Module Architecture

Each provider's usage fetching logic is extracted into independent utility modules with unified interface design:

```
src/utils/usage/
├── claude.ts      # Claude Code - Local log reading
├── github.ts      # GitHub Copilot - API calls
├── google.ts      # Google Antigravity - Cloud API + Token refresh
├── gemini.ts      # Gemini CLI - Cloud API + Token refresh + retry
└── zhipu.ts       # Zhipu AI / Z.ai - API Key authentication
```

### Unified Interface

All Usage modules follow the unified `FetchUsageResult` interface:

```typescript
export interface FetchUsageResult {
  success: boolean
  usage: UsageCategory[]
  error?: string
  lastUpdated: string
}
```

### Design Principles

- **Pure Functions**: Usage functions do not depend on external state, input credential, return result
- **Token Refresh Callback**: For providers that need token refresh (Google, Gemini), notify caller to update storage via callback function
- **Error Handling**: All errors are wrapped in `FetchUsageResult`, no exceptions thrown
- **Separation of Concerns**: `use-usage.ts` is only responsible for coordination and scheduling, specific API call logic is delegated to utils

### Usage Example

```typescript
// Call method in use-usage.ts
const result = await fetchGitHubCopilotUsage()
if (!result.success) {
  return createErrorAccount(account, result.error)
}
return {
  id: account.id,
  alias: account.alias,
  credential: account.credential,
  usage: result.usage,
  lastUpdated: result.lastUpdated
}
```

### Code Rules

- **Unidirectional Data Flow**: Strictly prohibit lower-layer modules from calling upper-layer modules (e.g., `useUsage` cannot call `useView`)
- **Utility Function Separation**: Pure logic, stateless code should be placed in `src/utils/`
- **WatchEffect**: Prefer using `watchEffect` for reactive dependencies to avoid deep traversal of configuration Proxy objects

### Related Documentation

- [UI/UX Design Guidelines](./ui-ux.md) - Interface styles and interaction design
- [Authentication Mechanism](./authentication.md) - OAuth and Token management
