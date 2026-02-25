import { computed, useWebviewView } from 'reactive-vscode'
import { env } from 'vscode'
import type { ProviderId } from '../types'
import { useProviders } from './use-providers'

export function useView() {
  const { providersMap } = useProviders()

  const providers = computed(() =>
    (Object.keys(providersMap) as ProviderId[]).map((id) => ({
      id,
      name: providersMap[id].name,
      accounts: providersMap[id].accounts.value
    }))
  )

  const html = computed(() => {
    const providerList = [...providers.value]
    const hasAccounts = providerList.some((p) => p.accounts?.length > 0)
    const htmlLocale = env.language || 'en'

    return `<!DOCTYPE html>
    <html lang="${htmlLocale}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quota</title>
        <style>
            * { box-sizing: border-box; }
            body {
                padding: 0;
                margin: 0;
                color: var(--vscode-foreground);
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                line-height: 1.6;
                background-color: transparent;
            }
            .container {
                display: flex;
                flex-direction: column;
                height: 100vh;
            }
            .content {
                flex: 1;
                overflow-y: auto;
                padding: 0.5em 1em;
                display: flex;
                flex-direction: column;
            }
            .provider-section {
                margin-top: 0.6em;
                margin-bottom: 0.6em;
                padding-bottom: 0.8em;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            .provider-section:last-child {
                margin-bottom: 0;
                border-bottom: none;
            }
            .provider-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: 600;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 0.8em;
            }
            .account-block {
                margin-top: 1.2em;
                margin-bottom: 0.6em;
            }
            .provider-header + .account-block {
                margin-top: 0.8em;
            }
            .account-label {
                font-size: 0.85em;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 0.4em;
                font-weight: 500;
            }
            .account-error {
                color: var(--vscode-errorForeground);
                font-size: 0.8em;
                margin-top: 0.4em;
                word-break: break-all;
            }
            .usage-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(12em, 1fr));
                gap: 0.2em 1em;
            }
            .usage-title {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-bottom: 0.3em;
            }
            .usage-name {
                font-weight: 500;
                font-size: 0.85em;
            }
            .usage-value {
                font-size: 0.85em;
                color: var(--vscode-descriptionForeground);
                opacity: 0.8;
            }
            .progress-bar-container {
                height: 4px;
                background-color: var(--vscode-gauge-background);
                border-radius: 4px;
                border: 1px solid var(--vscode-gauge-border);
                overflow: hidden;
                margin: 2px 0;
            }
            .progress-bar {
                height: 100%;
                background-color: var(--vscode-gauge-foreground);
                border-radius: 4px;
                transition: width 0.2s ease;
            }
            .progress-bar.warning {
                background-color: var(--vscode-gauge-warningForeground);
            }
            .progress-bar.danger {
                background-color: var(--vscode-gauge-errorForeground);
            }
            .usage-reset {
                font-size: 0.85em;
                color: var(--vscode-descriptionForeground);
                opacity: 0.8;
                text-align: left;
            }
            .empty-state {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 2em 1.5em;
                color: var(--vscode-descriptionForeground);
                user-select: none;
                -webkit-user-select: none;
                cursor: default;
            }
            .empty-state-icon {
                margin-bottom: 8px;
                color: var(--vscode-editor-foreground);
                display: flex;
                justify-content: center;
            }
            .empty-state-icon svg {
                width: 60px;
                height: 60px;
            }
            .empty-state-title {
                font-size: 1.6em;
                font-weight: 500;
                margin-bottom: 4px;
                color: var(--vscode-editor-foreground);
            }
            .empty-state-description {
                font-size: 1em;
                color: var(--vscode-descriptionForeground);
                line-height: 1.5;
                max-width: 320px;
                margin: 0 auto;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="content">
                ${!hasAccounts ? renderEmptyState() : renderProviders(providerList, htmlLocale)}
            </div>
        </div>
        <script>
          (function() {
            const content = document.querySelector('.content');
            const scrollInfo = sessionStorage.getItem('quotaMonitorScroll');
            if (content && scrollInfo) {
              try {
                const { top, atBottom } = JSON.parse(scrollInfo);
                content.scrollTop = atBottom ? content.scrollHeight : top;
              } catch {}
            }
            if (content) {
              content.addEventListener('scroll', function() {
                const atBottom = Math.abs(content.scrollHeight - content.scrollTop - content.clientHeight) < 2;
                sessionStorage.setItem('quotaMonitorScroll', JSON.stringify({ top: content.scrollTop, atBottom }));
              });
            }
            function updateTimers() {
              const now = new Date();
              document.querySelectorAll('.usage-reset[data-reset-time]').forEach(el => {
                const targetStr = el.getAttribute('data-reset-time');
                if (!targetStr) return;
                const target = new Date(targetStr);
                const diffMs = target.getTime() - now.getTime();
                if (diffMs <= 0) {
                  el.textContent = 'Resetting...';
                  return;
                }
                const totalHours = Math.floor(diffMs / 3600000);
                const days = Math.floor(totalHours / 24);
                const hours = totalHours % 24;
                const mins = Math.floor((diffMs % 3600000) / 60000);
                const secs = Math.floor((diffMs % 60000) / 1000);
                const timeStr = days > 0 ? (days + 'd ' + hours + 'h') : totalHours > 0 ? (totalHours + 'h ' + mins + 'm') : (mins + 'm ' + secs + 's');
                el.textContent = 'Reset ' + timeStr;
              });
            }
            setInterval(updateTimers, 1000);
          })();
        </script>
    </body>
    </html>`
  })

  function renderEmptyState(): string {
    const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20V14"/></svg>`
    return `<div class="empty-state"><div class="empty-state-icon">${svg}</div><div class="empty-state-title">No Active Accounts</div><div class="empty-state-description">Add an account to monitor your quota usage</div></div>`
  }

  function renderProviders(list: any[], locale: string): string {
    return list
      .filter((p) => p.accounts?.length > 0)
      .map((p) => renderProvider(p, locale))
      .join('')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function renderProvider(provider: any, _locale: string): string {
    const accounts = provider.accounts || []
    const hasMultiple = accounts.length > 1
    return `<div class="provider-section"><div class="provider-header"><span>${provider.name}</span></div>${accounts.map((acc: any) => renderAccount(acc, hasMultiple)).join('')}</div>`
  }

  function renderAccount(account: any, showLabel: boolean): string {
    const errorHtml = account.error
      ? `<div class="account-error">${account.error}</div>`
      : ''
    const usageHtml = account.usage.map((u: any) => renderUsageItem(u)).join('')
    if (!showLabel)
      return `<div class="account-block">${errorHtml}<div class="usage-grid">${usageHtml}</div></div>`
    return `<div class="account-block"><div class="account-label">${account.name}</div>${errorHtml}<div class="usage-grid">${usageHtml}</div></div>`
  }

  function renderUsageItem(usage: any): string {
    const usedPercent =
      usage.total > 0
        ? Math.min(100, Math.round((usage.used / usage.total) * 100))
        : 0
    const statusClass =
      usedPercent >= 90 ? 'danger' : usedPercent >= 75 ? 'warning' : ''
    const displayValue =
      usage.type === 'percentage'
        ? `${usedPercent}%`
        : usage.total
          ? `${usage.used} / ${usage.total}`
          : String(usage.used)
    let resetHtml = ''
    if (usage.resetTime) {
      const date = new Date(usage.resetTime)
      const now = new Date()
      const diffMs = date.getTime() - now.getTime()
      if (diffMs > 0) {
        const totalHours = Math.floor(diffMs / 3600000)
        const days = Math.floor(totalHours / 24)
        const hours = totalHours % 24
        const mins = Math.floor((diffMs % 3600000) / 60000)
        const secs = Math.floor((diffMs % 60000) / 1000)
        const timeStr =
          days > 0
            ? `${days}d ${hours}h`
            : totalHours > 0
              ? `${totalHours}h ${mins}m`
              : `${mins}m ${secs}s`
        resetHtml = `<div class="usage-reset" data-reset-time="${usage.resetTime}">Reset ${timeStr}</div>`
      } else {
        resetHtml = `<div class="usage-reset">Resetting...</div>`
      }
    }
    return `<div class="usage-item"><div class="usage-title"><span class="usage-name">${usage.name}</span><span class="usage-value">${displayValue}</span></div><div class="progress-bar-container"><div class="progress-bar ${statusClass}" style="width: ${usedPercent}%"></div></div>${resetHtml}</div>`
  }

  useWebviewView('unifyQuotaMonitor.usageView', html, {
    webviewOptions: { enableScripts: true }
  })
}
