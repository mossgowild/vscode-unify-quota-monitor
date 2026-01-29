# Unify Quota Monitor

> A beautiful VS Code extension to monitor usage quotas for multiple AI providers in real-time

![Preview](images/image.png)

## ✨ Why Unify Quota Monitor?

When using multiple AI services, it's tedious to switch between platforms to check quota usage. This extension consolidates all usage information into a single sidebar panel, giving you an at-a-glance view of quota usage across all your accounts.

---

## 🚀 Quick Start

### Installation

Search for **"Unify Quota Monitor"** in the VS Code Extension Marketplace and click install

### Add Your First Account

1. Click the **Quota** icon in the sidebar
2. Click the **$(plus)** button in the top-right corner
3. Select a Provider
4. Follow the authentication prompts

That's it! You can now monitor your quota usage in real-time.

---

## 📦 Supported Providers

| Provider | Quota Types | Authentication |
|----------|-------------|----------------|
| **OpenAI** | Token usage, reset countdown | Access Token (JWT) |
| **Zhipu AI** | Token limits, MCP quotas | API Key |
| **Z.ai** | Token limits, MCP quotas | API Key |
| **Google Antigravity** | Token usage, reset countdown | Google OAuth |
| **Gemini CLI** | Usage percentage, reset countdown | Google OAuth |

---

## 🎯 Key Features

### 📊 Real-time Monitoring
- Display quota usage for all providers in the sidebar
- Clear progress bars and percentage displays
- Automatic reset countdowns (e.g., "4h25m" until reset)

### 👥 Multi-Account Management
- Add multiple accounts per provider
- Set account aliases (e.g., "Work", "Personal")
- Single account: no label shown
- Multiple accounts: clear display with aliases or IDs

### 🔄 Auto Refresh
- Auto-refresh every 60 seconds by default
- Automatic display on first load, no manual action needed
- Customize refresh interval or disable in settings

### 🌍 Internationalization
- Support for English and Chinese
- Automatically follows VS Code language settings

---

## 📖 User Guide

### Adding Accounts

1. Click the **Quota** icon in the sidebar
2. Click the **$(plus)** button in the top-right corner
3. Select a Provider:
   - **OpenAI**: Enter Access Token (JWT) or login via OAuth
   - **Zhipu AI / Z.ai**: Enter API Key
   - **Google Antigravity / Gemini CLI**: Authenticate via browser OAuth
4. (Optional) Set an account alias

### Managing Accounts

1. Click the **$(plus)** button in the top-right corner
2. Click on an account in the logged-in accounts list
3. Choose an action:
   - **Set Alias**: Modify account display name
   - **Relogin**: Update authentication credentials
   - **Logout**: Remove the account

### Refreshing Usage

Click the **$(refresh)** button in the top-right corner to manually refresh usage data for all accounts

---

## ⚙️ Configuration

Search for `unifyQuotaMonitor` in VS Code Settings:

### Auto Refresh Configuration

```json
{
  "unifyQuotaMonitor.autoRefresh": {
    "enabled": true,
    "intervalMs": 60000
  }
}
```

- `enabled`: Enable auto-refresh (default: `true`)
- `intervalMs`: Refresh interval in milliseconds (default: `60000` = 1 minute)

---

## ❓ FAQ

**Q: How do I distinguish between multiple accounts?**  
A: Set aliases for each account (e.g., "Work", "Personal") for easy identification.

**Q: Will auto-refresh affect performance?**  
A: No. Default refresh is once per minute and very lightweight. Adjust in settings if needed.

**Q: Where is the data stored?**  
A: All account data is stored in VS Code's global settings, secure and reliable.

**Q: When are account labels displayed?**  
A: Account labels are hidden when a provider has only one account, and shown (alias or ID) when there are multiple accounts.

---

## 🎨 Interface Guide

### Sidebar Panel
- **Provider Section**: Displays each provider's name
- **Account Section**:
  - **Single Account**: No account label, shows usage directly
  - **Multiple Accounts**: Shows each account's alias or ID with corresponding usage details
- **Usage Information**:
  - Progress Bar: Visual percentage display
  - Usage Values: Specific usage amounts (Token unit: M)
  - Reset Countdown: Time remaining until reset (e.g., "4h25m")

### Toolbar Buttons
- **$(plus) Add Account**: Open account management menu
- **$(refresh) Refresh**: Manually refresh all account usage data (shows progress bar during refresh)

---

## 🔧 Developer Information

### Install from Source

```bash
git clone https://github.com/mossgowild/vscode-unify-quota-monitor.git
cd vscode-unify-quota-monitor
npm install
npm run build
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

---

## 📝 Changelog

### Unreleased
- ✨ Add Gemini CLI support
- 🎯 Support for Gemini 3/2.5/2.0/1.5 series models
- 🔐 Google OAuth authentication for Gemini CLI

### 0.0.1 (2025-01-23)
- ✨ Initial release
- 🎯 Support for OpenAI, Zhipu AI, Z.ai, Google Antigravity
- 👥 Multi-account support
- 🏷️ Account aliases
- 🔄 Auto-refresh functionality
- 🌍 Internationalization (English/Chinese)

---

## 🌏 [中文文档](README_ZH.md)
