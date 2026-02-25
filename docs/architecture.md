# Architecture

## Overview

Unify Quota Monitor uses **Reactive MVC** with **Unidirectional Data Flow**, built on the `reactive-vscode` framework.

## Supported Providers

| ID | Name | Auth | Stored |
|---|---|---|---|
| `antigravity` | Google Antigravity | OAuth | refresh_token |
| `gemini` | Gemini CLI | OAuth | accessToken + refresh_token |
| `copilot` | GitHub Copilot | OAuth | VS Code session |
| `zhipu` | Zhipu AI | API Key | API Key |
| `zai` | Z.AI | API Key | API Key |
| `kimi` | Kimi Code | API Key | API Key |

## Project Structure

```
src/
├── extension.ts          # Entry: composables init order
├── types.ts              # Type exports
├── composables/          # Reactive-vscode composables
│   ├── use-*.ts          # Core composables (config, providers, view, menu)
│   └── use-*-provider.ts # Provider implementations
└── utils/                # Stateless helpers
```

## Layer Architecture

```
┌─────────────────────────────────────────┐
│  View Layer                             │
│  ├── useMenu (QuickPick menus)          │
│  └── useView (Webview HTML)             │
│       ↓ only reads providersMap          │
├─────────────────────────────────────────┤
│  Controller Layer                       │
│  └── useProviders                       │
│       ├── manages provider instances    │
│       └── provides global refresh       │
│       ↓ only calls useConfig             │
├─────────────────────────────────────────┤
│  Model Layer                            │
│  └── useConfig (reactive-vscode)        │
│       └── configuration persistence     │
├─────────────────────────────────────────┤
│  Domain Layer                           │
│  └── providers/*                        │
│       └── auth + usage fetch logic      │
└─────────────────────────────────────────┘
```

## Data Flow

```
User Action → useMenu → providersMap[id].login()
                ↓
          config.providers updated
                ↓
    providersMap[id].accounts reacts
                ↓
        useView html recomputes
                ↓
           Webview re-renders
```

## Key Principles

1. **No upward calls**: Lower layers cannot call upper layers
2. **providersMap is the interface**: View layers read from `providersMap`, never call `useProviders` methods
3. **Direct method access**: `providersMap[id].login()`, `.logout()`, `.rename()`, `.refresh()`
4. **Reactive by default**: All state changes flow through Vue reactivity

## Framework APIs

| API | Purpose | Used In |
|-----|---------|---------|
| `defineConfig` | Reactive configuration | `useConfig` |
| `useWebviewView` | Webview panel | `useView` |
| `ref/computed/watch` | Vue reactivity | All composables |

## Initialization Order

```typescript
// extension.ts
const { refresh } = useProviders()    // 1. Sets up providers + auto-refresh
const { showAccountMenu } = useMenu() // 2. Menu uses providersMap internally
useView()                             // 3. Registers webview, reads providersMap
```

#### Provider Registration
```typescript
// use-providers.ts
const zhipu = useZhipuProvider()
const zai = useZaiProvider()
// ...

const providersMap: Record<ProviderId, UseBaseProviderReturn> = {
  zhipu: zhipu,
  zai: zai,
  // ...
}
```

#### Config-Driven Provider Example (Zhipu)
```typescript
// use-zhipu-provider.ts
export function useZhipuProvider() {
  return useApiKeyProvider({
    id: 'zhipu',
    name: 'Zhipu AI',
    keyPrefix: 'sk-',
    fetchUsage: fetchZhipuUsage,
  })
}
```

### Code Rules

- **Unidirectional Data Flow**: Lower layers never call upper layers (e.g., domain layer cannot call view layer)
- **Provider Encapsulation**: Provider auth/usage logic in composables (`use-*-provider.ts`)
- **Watch**: Use Vue `watch` for reactive dependencies, avoid deep Proxy traversal

### Related Documentation

- [Composables](./composables.md) - Core building blocks
- [Providers](./providers.md) - Provider implementations
- [Authentication](./authentication.md) - OAuth and Token management
- [UI/UX](./ui-ux.md) - Design guidelines