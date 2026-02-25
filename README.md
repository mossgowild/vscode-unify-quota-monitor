# Unify Quota Monitor

> A beautiful VS Code extension to monitor usage quotas for multiple providers in real-time

![Preview](images/image.png)

Tired of switching between platforms to check your AI quota usage? This extension consolidates all usage information into a single sidebar panel, giving you an at-a-glance view of quota usage across all your accounts.

## Quick Start

1. Install from VS Code Extension Marketplace
2. Click the **Quota** icon in the sidebar
3. Click **$(plus)** → Select Provider → Authenticate

That's it! You can now monitor your quota usage in real-time.

## Supported Providers

| Provider | Quota Types | Authentication |
|----------|-------------|----------------|
| Zhipu AI | Token limits, MCP quotas | API Key |
| Z.AI | Token limits, MCP quotas | API Key |
| Kimi Code | Weekly usage, rate limits | API Key |
| Google Antigravity | Token usage, reset countdown | Google OAuth |
| Gemini CLI | Usage percentage, reset countdown | Google OAuth |
| GitHub Copilot | Premium requests, reset countdown | GitHub OAuth |

## Features

- **Real-time Monitoring**: All quotas in one sidebar panel
- **Smart Sorting**: Most remaining quota shown first
- **Multi-Account**: Add multiple accounts per provider with aliases
- **Auto Refresh**: Every 60 seconds by default

## User Guide

### Adding Accounts

1. Click the **$(plus)** button in the top-right corner of the Quota panel
2. Select a Provider:
   - **Zhipu AI / Z.AI / Kimi**: Enter your API Key
   - **Google Antigravity / Gemini CLI**: Authenticate via browser OAuth
   - **GitHub Copilot**: Uses VS Code's built-in GitHub authentication
3. (Optional) Set an account alias like "Work" or "Personal"

### Managing Accounts

1. Click the **$(plus)** button in the top-right corner
2. Click on any account in the list
3. Choose an action:
   - **Set Name**: Rename the account
   - **Logout**: Remove the account

### Understanding the Display

- **Provider Section**: Shows the provider name
- **Account Section**: 
  - Single account: No label, shows usage directly
  - Multiple accounts: Shows alias/ID for each account
- **Progress Bars**: Visual percentage of quota used
  - Green: Normal usage
  - Yellow: ≥75% used
  - Red: ≥90% used
- **Reset Timer**: Countdown to quota reset (e.g., "4h 25m")

### Refreshing Data

- **Auto Refresh**: Every 60 seconds by default
- **Manual Refresh**: Click the **$(refresh)** button in the top-right corner

## Configuration

Search for `unifyQuotaMonitor` in VS Code Settings:

```json
{
  "unifyQuotaMonitor.autoRefreshEnabled": true,
  "unifyQuotaMonitor.autoRefreshIntervalMs": 60000
}
```

| Option | Description | Default |
|--------|-------------|---------|
| `autoRefreshEnabled` | Enable automatic refresh | `true` |
| `autoRefreshIntervalMs` | Refresh interval in milliseconds | `60000` (1 minute) |

## FAQ

**Q: How do I distinguish between multiple accounts?**  
A: Set aliases for each account (e.g., "Work", "Personal") when adding or by editing the account.

**Q: Where is my data stored?**  
A: All account credentials are stored securely in VS Code's global settings.

**Q: Will auto-refresh affect performance?**  
A: No. The default refresh is once per minute and very lightweight.

**Q: Why isn't my GitHub Copilot quota showing?**  
A: Make sure you're signed into GitHub in VS Code. The extension uses VS Code's native GitHub authentication.

## Development

```bash
git clone https://github.com/mossgowild/vscode-unify-quota-monitor.git
cd vscode-unify-quota-monitor
npm install
npm run build
```
code .
```

### Available Commands

- `unifyQuotaMonitor.manageAccounts`: Open account management menu
- `unifyQuotaMonitor.refresh`: Refresh usage data

### Configuration Fields

**unifyQuotaMonitor.providers** (Auto-managed by extension, no manual editing needed)
```json
[
  {
    "provider": "openai",
    "name": "OpenAI Group",
    "accounts": [
      {
        "credential": "sk-xxx...",
        "name": "Work Account"
      }
    ]
  }
]
```

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📄 License

[MIT](LICENSE)
