# Unify Quota Monitor

VS Code extension using `reactive-vscode` to display real-time AI provider usage quotas in a sidebar panel.

## Quick Start

```bash
npm install          # Install dependencies
npm run build        # Build extension
npm run typecheck    # Type check
F5                   # Start debugging
```

## Commands

| ID | Title | Description |
|---|---|---|
| `unifyQuotaMonitor.refresh` | Refresh | Refresh all quota data |
| `unifyQuotaMonitor.settings` | Settings | Open account menu |

## Documentation

- [Architecture](./docs/architecture.md) - MVC layers, data flow, constraints
- [Composables](./docs/composables.md) - useConfig, useProviders, useView, useMenu
- [Providers](./docs/providers.md) - Provider composables and implementations
- [Authentication](./docs/authentication.md) - OAuth flows, API keys, token refresh
- [UI/UX](./docs/ui-ux.md) - Design guidelines, styling patterns

