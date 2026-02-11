# AGENTS.md

## Project Overview

`unify-quota-monitor` is a VS Code extension that uses the `reactive-vscode` framework to display real-time usage quotas for multiple providers (Google Antigravity, GitHub Copilot, Gemini CLI, Zhipu AI, Z.AI, Kimi Code) in a sidebar Panel.

## Quick Start

```bash
# Install dependencies
npm install

# Start debugging
F5

# Build
npm run build

# Type check
npm run typecheck

# Lint
npx eslint
```

## Directory Structure

```
src/
├── extension.ts          # Plugin entry point, initializes Composables in order
├── types.ts              # Core type definitions (ProviderId, UsageCategory, Account, ProviderConfig)
├── constants.ts          # Global constant definitions (error messages, UI text)
├── providers.ts          # Provider static metadata definitions (getProviderDefinition)
├── composables/
│   ├── use-config.ts     # Model layer foundation - defineConfig defines configuration interface
│   ├── use-accounts.ts   # Model layer helper - Account CRUD wrapper (computed, ConfigurationTarget)
│   ├── use-usage.ts      # Controller layer - defineService, data fetching and auto-refresh
│   └── use-view.ts       # View layer - useWebviewView, HTML generation and UI interaction
└── utils/
    ├── auth/
    │   ├── oauth.ts      # Generic OAuth protocol underlying implementation (PKCE, HTTP Server callback)
    │   ├── antigravity.ts # Google Antigravity OAuth authentication flow
    │   ├── gemini.ts     # Gemini CLI OAuth authentication flow
    │   ├── github.ts     # GitHub Copilot authentication flow
    │   └── api-key.ts    # API Key input interaction logic (Zhipu AI, Z.AI, Kimi Code)
    └── usage/
    ├── google.ts     # Google Antigravity usage API calls
    ├── gemini.ts     # Gemini CLI usage API calls
    ├── github.ts     # GitHub Copilot usage API calls
    ├── zhipu.ts      # Zhipu AI / Z.AI usage API calls
    └── kimi.ts       # Kimi Code usage API calls
```

**Initialization Order** (extension.ts):
```typescript
useConfig()      // 1. Define configuration interface (accounts, autoRefresh)
useAccounts()    // 2. Initialize Account CRUD wrapper
useUsage()       // 3. Start data service (defineService)
useView()        // 4. Register Webview view (useWebviewView)
```

## Core Architecture

**Reactive MVC + Unidirectional Data Flow**, based on `reactive-vscode` framework:

```
View (useView) → Model (config) → Controller (useUsage) → View (useView)
User operation → Update config → Auto-refresh data → Re-render
```

### Framework APIs

- **defineConfig**: Reactive configuration management (Model layer)
- **defineService**: Service container, singleton pattern (Controller layer)
- **useWebviewView**: Webview view management (View layer)
- **Vue Reactivity**: `ref`, `computed`, `watchEffect` for automatic reactivity
- **useCommand**: Command registration (showAccountMenu, refresh)

### Call Constraints

| Layer | Module | Framework API | Can Only Call | Responsibilities |
|---|---|---|---|---|
| View | `useView` | useWebviewView | `useUsage`, `config`, `utils` | HTML template generation, QuickPick menus, write config |
| Controller | `useUsage` | defineService | `useAccounts`, `utils` | API requests, watchEffect auto-refresh |
| Model | `useAccounts` | - | `useConfig` | computed account lists, CRUD wrapper |
| Model | `useConfig` | defineConfig | None | Configuration interface definition (providers, autoRefresh) |
| Utils | `utils/` | - | None | OAuth flow, PKCE, HTTP Server |

### Supported Providers

| ID | Name | Authentication | Stored Content |
|---|---|---|---|
| `google-antigravity` | Google Antigravity | OAuth | refresh_token (port 51121) |
| `gemini-cli` | Gemini CLI | OAuth | accessToken + refresh_token (port 51121) |
| `zhipu` | Zhipu AI | API Key | API Key |
| `zai` | Z.AI | API Key | API Key |
| `github-copilot` | GitHub Copilot | OAuth | VS Code authentication.getSession() |
| `kimi-code` | Kimi Code | API Key | API Key (prefix sk-kimi) |

### Core Features

- **Automatic Reactivity**: `config` changes trigger `watchEffect` recalculation, automatically refresh data
- **Smart Sorting**:
  - **Provider Ordering**: Provider display order in the panel strictly follows the order in `unifyQuotaMonitor.providers` configuration
  - **Quota Sorting**: Sorted by usage percentage (Used / Total) in ascending order, meaning more remaining quota appears first
- **Debounce Optimization**: `useUsage` implements debouncing to avoid excessive API requests from frequent config changes
- **Stateless Utility Functions**: Authentication logic handled by stateless functions (`loginWithAntigravity`, `loginWithApiKey`, `loginWithGeminiCli`, `loginWithGitHub`)
- **Service Singleton**: `defineService` ensures `useUsage` global unique instance

### Provider Usage Types

| Provider | Usage Type | Description |
|---|---|---|
| Google Antigravity | Percentage | Display remaining percentage by model |
| **Gemini CLI** | **Percentage** | API returns `remainingFraction` (0.0-1.0), displayed as used percentage |
| Zhipu AI / Z.AI | Token / Request | Token limits + MCP quotas |
| GitHub Copilot | Request | Premium Request limits |
| Kimi Code | Percentage | Weekly usage percentage + rate limit details percentage |

**Gemini CLI Special Handling**:
- API returns `buckets[]` array, each bucket contains `modelId`, `remainingFraction`, `resetTime`
- `remainingFraction` is **remaining ratio** (0.0-1.0), not specific request count
- Displayed as used percentage: `(1 - remainingFraction) * 100`
- Supports 20+ model mappings (`gemini-3-pro-preview` → "Gemini 3 Pro")

**Kimi Code Special Handling**:
- All usage items (Weekly Usage and Rate Limit Details) are displayed as percentages
- API returns `used` and `limit` fields for percentage calculation: `(used / limit) * 100`
- Weekly Usage always displayed first, Rate Limit Details sorted by usage percentage in ascending order
- Supports multiple time window rate limit details, uniformly displayed as "Rate Limit Details"

### Data Flow Example

```typescript
// User adds account
view.showAccountMenu() → loginWithGoogle() → useAccounts.addAccount() → config.update('providers', [...])

// Auto-reactivity
config.providers changes → watchEffect triggers → useUsage.fetchAllUsage() → providers update → html recalculates

// Auto-refresh
setInterval(intervalMs) → usage.refresh() → Refetch all account usage
```

## Build System

The project uses **Vite** for building and development, configuration located in `vite.config.ts`.

- **Build Tool**: Vite (Library Mode)
- **Output Format**: CommonJS (`dist/extension.cjs`)
- **Runtime Environment**: Node.js 22 (VS Code extension host environment)
- **Development Mode**: `npm run dev` uses Vite Watch mode for real-time compilation

## Detailed Documentation

- 📐 [Architecture Design](./docs/architecture.md) - MVC pattern, data flow, reactivity system details
- 🎨 [UI/UX Design](./docs/ui-ux.md) - Complete style guidelines, layout system, interaction design
- 🔐 [Authentication Mechanism](./docs/authentication.md) - OAuth flow, Token management, storage security
- 📜 [Design History](./docs/design-history.md) - UI/UX evolution records and change notes

## Code Rules

- **Unidirectional Data Flow**: Strictly prohibit lower-layer modules from calling upper-layer modules (e.g., `useUsage` cannot call `useView`)
- **Utility Function Separation**: Pure logic, stateless code should be placed in `src/utils/`
- **WatchEffect**: Prefer using `watchEffect` for reactive dependencies to avoid deep traversal of configuration Proxy objects

## Maintenance Guidelines

- **Configuration Default Value Synchronization**: When modifying configuration default values, must simultaneously update the default values in `package.json`'s `configuration` section and constant definitions in `src/composables/use-config.ts` to ensure consistency.

## Agent Skills

This project includes Agent Skills for assisting development, located in `.claude/skills/` directory:

| Skill | Purpose |
|-------|---------|
| `vscode-ext-config-sync` | Guides file linkage synchronization when modifying VS Code extension configurations, including Provider ID, commands, views, configuration items, etc. |

Usage: When modifying configuration-related content, Agent will automatically apply this Skill's linkage rules to ensure all related files are synchronized.

### Supported Commands

| Command ID | Title | Icon | Description |
|---------|------|------|------|
| `unifyQuotaMonitor.refresh` | Refresh / 刷新 | $(refresh) | Refresh quota data |
| `unifyQuotaMonitor.settings` | Settings / 设置 | $(gear) | Open account settings menu |
