# Composables

Composables are the core building blocks of this VS Code extension, following the `reactive-vscode` framework patterns.

## Overview

| Composable | Layer | Purpose |
|------------|-------|---------|
| `useConfig` | Model | Configuration management |
| `useProviders` | Controller | Provider aggregation & global refresh |
| `useMenu` | View | QuickPick menu interactions |
| `useView` | View | Webview panel & HTML generation |

## useConfig

**File**: `src/composables/use-config.ts`

Configuration management using `defineConfig` from reactive-vscode.

```typescript
export function useConfig() {
  return defineConfig<Config>('unifyQuotaMonitor')
}
```

### Config Structure

```typescript
interface Config {
  providers: Record<ProviderId, ConfigAccount[]>
  autoRefreshEnabled: boolean
  autoRefreshIntervalMs: number
}
```

### Usage

```typescript
const config = useConfig()

// Read
const accounts = config.providers['zhipu']

// Write
config.providers['zhipu'] = [...accounts, newAccount]
```

## useProviders

**File**: `src/composables/use-providers.ts`

Aggregates all provider instances and manages global refresh.

```typescript
export interface UseProvidersReturn {
  providersMap: Record<ProviderId, UseBaseProviderReturn>
  refresh: (providerId?: ProviderId, accountIndex?: number) => Promise<void>
}
```

### providersMap

Direct access to all provider instances:

```typescript
const { providersMap } = useProviders()

// Access specific provider
providersMap['zhipu'].login()
providersMap['kimi'].logout(0)
providersMap['zhipu'].rename(0, 'Work')
providersMap['zhipu'].accounts.value  // reactive accounts
```

### refresh

Global refresh with optional targeting:

```typescript
const { refresh } = useProviders()

await refresh()                    // Refresh all
await refresh('zhipu')            // Refresh specific provider
await refresh('zhipu', 0)         // Refresh specific account
```

### Auto Refresh

Automatically sets up interval based on config:

```typescript
watch(
  [() => config.autoRefreshEnabled, () => config.autoRefreshIntervalMs],
  ([enabled, intervalMs]) => {
    if (enabled) {
      timer = setInterval(() => refresh(), intervalMs)
    }
  }
)
```

## useMenu

**File**: `src/composables/use-menu.ts`

QuickPick menu interactions for account management.

```typescript
export function useMenu() {
  const { providersMap } = useProviders()
  // ...
  return { showAccountMenu, showAccountActions }
}
```

### showAccountMenu

Displays all accounts with "Add Account" option:

```typescript
async function showAccountMenu(): Promise<void>
```

**Flow**:
1. Lists all provider accounts
2. Shows "Add Account" option
3. On account selection → shows account actions
4. On "Add Account" → shows provider selection → calls `login()`

### showAccountActions

Actions for a specific account:

```typescript
async function showAccountActions(
  providerId: ProviderId,
  accountIndex: number
): Promise<void>
```

**Actions**:
- ← Back: Return to account menu
- Set Name: Rename account
- Logout: Remove account

## useView

**File**: `src/composables/use-view.ts`

Webview panel registration and HTML generation.

```typescript
export function useView() {
  const { providersMap } = useProviders()
  
  const html = computed(() => {
    // Generate HTML from providersMap
  })
  
  useWebviewView('unifyQuotaMonitor.usageView', html, {
    webviewOptions: { enableScripts: true }
  })
}
```

### HTML Generation

- Reactive: `html` computed updates when `providersMap` changes
- No return value: Composable only registers the webview
- Scroll preservation: Maintains scroll position across updates

### Data Access

```typescript
const providers = computed(() =>
  (Object.keys(providersMap) as ProviderId[]).map((id) => ({
    id,
    name: providersMap[id].name,
    accounts: providersMap[id].accounts.value
  }))
)
```

## Layer Constraints

```
┌─────────────────────────────────────────┐
│  View Layer                             │
│  ├── useMenu (QuickPick)                │
│  └── useView (Webview)                  │
│       ↓ can only call providersMap       │
├─────────────────────────────────────────┤
│  Controller Layer                       │
│  └── useProviders                       │
│       ↓ can only call useConfig          │
├─────────────────────────────────────────┤
│  Model Layer                            │
│  └── useConfig (defineConfig)           │
│       (no upward calls)                  │
├─────────────────────────────────────────┤
│  Domain Layer                           │
│  └── providers/*                        │
│       (no upward calls)                  │
└─────────────────────────────────────────┘
```
