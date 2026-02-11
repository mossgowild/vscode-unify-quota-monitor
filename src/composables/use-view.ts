import { computed, useWebviewView } from 'reactive-vscode'
import {
  env,
  QuickPickItemKind,
  QuickPickItem,
  window
} from 'vscode'
import type { ProviderId } from '../types'
import { getAllProviderDefinitions, getProviderDefinition } from '../providers'
import { useUsage } from './use-usage'
import { useAccounts } from './use-accounts'
import { useConfig } from './use-config'
import { loginWithAntigravity } from '../utils/auth/antigravity'
import { loginWithApiKey } from '../utils/auth/api-key'
import { loginWithGitHub } from '../utils/auth/github'
import { loginWithGeminiCli } from '../utils/auth/gemini'
import { ERROR_MESSAGES, UI_MESSAGES, UI_TEXT } from '../constants'

export function useView() {
  const { 
    getAccounts, 
    addAccount: addAccountToConfig, 
    deleteAccount: deleteAccountConfig, 
    updateAccountName, 
    updateCredential 
  } = useAccounts()
  const { providers, hasLoadedOnce } = useUsage()
  const config = useConfig()

  const html = computed(() => {
    const providerList = [...providers.value]
    const configProviders = config.providers || []
    
    // Create index map
    const providerOrder = new Map<string, number>()
    configProviders.forEach((p, index) => {
      // Use set to ensure first occurrence determines order if duplicates exist
      if (!providerOrder.has(p.provider)) {
        providerOrder.set(p.provider, index)
      }
    })
    
    providerList.sort((a, b) => {
      const orderA = providerOrder.has(a.id) ? providerOrder.get(a.id)! : 9999
      const orderB = providerOrder.has(b.id) ? providerOrder.get(b.id)! : 9999
      
      if (orderA !== orderB) {
        return orderA - orderB
      }
      return 0 
    })

    const hasAccounts = providerList.some(
      (p) => p.accounts && p.accounts.length > 0
    )
    const htmlLocale = env.language || 'en'

    const showEmptyState = !hasAccounts && hasLoadedOnce.value

    return `<!DOCTYPE html>
    <html lang="${htmlLocale}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quota</title>
        <style>
            * {
                box-sizing: border-box;
            }
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
                ${showEmptyState ? renderEmptyState() : renderProviders(providerList, htmlLocale)}
            </div>
        </div>
        <script>
          // 滚动位置恢复逻辑
          (function() {
            const content = document.querySelector('.content');
            // 恢复滚动
            const scrollInfo = sessionStorage.getItem('quotaMonitorScroll');
            if (content && scrollInfo) {
              try {
                const { top, atBottom } = JSON.parse(scrollInfo);
                if (atBottom) {
                  // 刷新前在底部，刷新后也滚到底
                  content.scrollTop = content.scrollHeight;
                } else {
                  content.scrollTop = top;
                }
              } catch {}
            }
            // 监听滚动，保存位置
            if (content) {
              content.addEventListener('scroll', function() {
                const atBottom = Math.abs(content.scrollHeight - content.scrollTop - content.clientHeight) < 2;
                sessionStorage.setItem('quotaMonitorScroll', JSON.stringify({
                  top: content.scrollTop,
                  atBottom
                }));
              });
            }
            // 定时器逻辑
            function updateTimers() {
              const now = new Date();
              const elements = document.querySelectorAll('.usage-reset[data-reset-time]');
              elements.forEach(el => {
                const targetStr = el.getAttribute('data-reset-time');
                if (!targetStr) return;
                const target = new Date(targetStr);
                const template = el.getAttribute('data-template');
                const diffMs = target.getTime() - now.getTime();
                if (diffMs > 0) {
                  const totalHours = Math.floor(diffMs / 3600000);
                  const days = Math.floor(totalHours / 24);
                  const hours = totalHours % 24;
                  const mins = Math.floor((diffMs % 3600000) / 60000);
                  const secs = Math.floor((diffMs % 60000) / 1000);
                  let timeStr = '';
                  if (days > 0) {
                    timeStr = days + 'd ' + hours + 'h';
                  } else if (totalHours > 0) {
                    timeStr = totalHours + 'h ' + mins + 'm';
                  } else {
                    timeStr = mins + 'm ' + secs + 's';
                  }
                  el.textContent = template.replace('{{TIME}}', timeStr);
                }
              });
            }
            setInterval(updateTimers, 1000);
          })();
        </script>
    </body>
    </html>`
  })

  function renderEmptyState(): string {
    const title = UI_MESSAGES.NO_ACTIVE_ACCOUNT.TITLE
    const description = UI_MESSAGES.NO_ACTIVE_ACCOUNT.DESCRIPTION

    const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20V14" />
    </svg>`

    return `
        <div class="empty-state">
            <div class="empty-state-icon">${svg}</div>
            <div class="empty-state-title">${title}</div>
            <div class="empty-state-description">${description}</div>
        </div>
    `
  }

  function renderProviders(providerList: any[], locale: string): string {
    return providerList
      .filter(
        (p) => p.accounts && Array.isArray(p.accounts) && p.accounts.length > 0
      )
      .map((p) => renderProvider(p, locale))
      .join('')
  }

  function renderProvider(provider: any, locale: string): string {
    const accounts = Array.isArray(provider.accounts) ? provider.accounts : []
    const hasMultipleAccounts = accounts.length > 1
    return `
        <div class="provider-section">
            <div class="provider-header">
                <span>${provider.name}</span>
            </div>
            ${accounts.map((acc: any) => renderAccount(acc, locale, hasMultipleAccounts)).join('')}
        </div>
    `
  }

  function renderAccount(
    account: any,
    locale: string,
    showLabel: boolean
  ): string {
    const accountLabel = account.alias || account.id
    const errorHtml = account.error
      ? `<div class="account-error">${account.error}</div>`
      : ''

    if (!showLabel) {
      return `
          <div class="account-block">
              ${errorHtml}
              <div class="usage-grid">
                  ${account.usage.map((u: any) => renderUsageItem(u)).join('')}
              </div>
          </div>
      `
    }

    return `
        <div class="account-block">
            <div class="account-label">${accountLabel}</div>
            ${errorHtml}
            <div class="usage-grid">
                ${account.usage.map((u: any) => renderUsageItem(u)).join('')}
            </div>
        </div>
    `
  }

  function renderUsageItem(usage: any): string {
    const percentage = usage.total > 0 ? usage.used / usage.total : 0
    const usedPercent = Math.min(100, Math.round(percentage * 100))

    let statusColorClass = ''
    if (usedPercent >= 90) {
      statusColorClass = 'danger'
    } else if (usedPercent >= 75) {
      statusColorClass = 'warning'
    }

    let displayValue = ''
    if (usage.percentageOnly) {
      displayValue = `${usedPercent}%`
    } else if (usage.limitType === 'token') {
      displayValue = `${(usage.used / 1000000).toFixed(1)}M / ${(usage.total / 1000000).toFixed(1)}M`
    } else {
      const unit = usage.limitType === 'request' ? '' : ' credits'
      displayValue = `${usage.used} / ${usage.total}${unit}`
    }

    let resetHtml = ''
    if (usage.resetTime) {
      const date = new Date(usage.resetTime)
      const now = new Date()
      const diffMs = date.getTime() - now.getTime()
      let resetText = ''

      if (diffMs > 0) {
        const resetTemplate = UI_MESSAGES.USAGE_ITEM.RESET_TEMPLATE
        const totalHours = Math.floor(diffMs / 3600000)
        const days = Math.floor(totalHours / 24)
        const hours = totalHours % 24
        const mins = Math.floor((diffMs % 3600000) / 60000)
        const secs = Math.floor((diffMs % 60000) / 1000)

        let timeStr = ''
        if (days > 0) {
          // 超过1天：显示日和小时
          timeStr = `${days}d ${hours}h`
        } else if (totalHours > 0) {
          // 1小时-24小时：显示小时和分钟
          timeStr = `${totalHours}h ${mins}m`
        } else {
          // 小于1小时：显示分钟和秒
          timeStr = `${mins}m ${secs}s`
        }
        resetText = resetTemplate.replace('{{TIME}}', timeStr)

        const safeTemplate = resetTemplate.replace(/"/g, '&quot;')
        resetHtml = `<div class="usage-reset" data-reset-time="${usage.resetTime}" data-template="${safeTemplate}">${resetText}</div>`
      } else {
        resetText = UI_MESSAGES.USAGE_ITEM.RESETTING
        resetHtml = `<div class="usage-reset">${resetText}</div>`
      }
    }

    return `
        <div class="usage-item">
            <div class="usage-title">
                <span class="usage-name">${usage.name}</span>
                <span class="usage-value">${displayValue}</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar ${statusColorClass}" style="width: ${usedPercent}%"></div>
            </div>
            ${resetHtml}
        </div>
    `
  }

  const { view } = useWebviewView('unifyQuotaMonitor.usageView', html, {
    webviewOptions: {
      enableScripts: true
    }
  })

  async function showAccountMenu() {
    const accounts = getAccounts()

    const items: (QuickPickItem & {
      action?: string
      accountId?: string
      providerId?: ProviderId
    })[] = []

    if (accounts.length > 0) {
      for (const account of accounts) {
        const providerDef = getProviderDefinition(account.providerId)
        const hasMultipleSameProvider = accounts.filter(a => a.providerId === account.providerId).length > 1
        const accountLabel = account.alias || (hasMultipleSameProvider ? account.id : '')
        
        items.push({
          label: providerDef?.name || account.providerId,
          description: accountLabel,
          action: 'manageAccount',
          accountId: account.id,
          providerId: account.providerId
        })
      }

      items.push({ label: '', kind: QuickPickItemKind.Separator } as any)
    }

    items.push({
      label: UI_TEXT.ACTIONS.ADD_PROVIDER,
      description: UI_TEXT.ACTIONS.ADD_PROVIDER_DESC,
      action: 'addProvider'
    } as any)

    const selected = await window.showQuickPick(items as QuickPickItem[], {
      title: UI_TEXT.TITLES.SETTINGS,
      placeHolder: UI_TEXT.PLACEHOLDERS.MANAGE_ACCOUNTS
    })

    if (!selected) return

    if ((selected as any).action === 'addProvider') {
      await addProviderAccount()
    } else if (
      (selected as any).action === 'manageAccount' &&
      (selected as any).accountId
    ) {
      await showAccountActions((selected as any).accountId)
    }
  }

  async function addProviderAccount() {
    const providers = getAllProviderDefinitions().sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    const items = providers.map(
      (p) =>
        ({
          label: p.name,
          description:
            p.auth.type === 'oauth'
              ? UI_TEXT.AUTH_TYPE.OAUTH
              : p.auth.type === 'key'
                ? UI_TEXT.AUTH_TYPE.API_KEY
                : UI_TEXT.AUTH_TYPE.ACCESS_TOKEN,
          providerId: p.id
        }) as QuickPickItem & { providerId: ProviderId }
    )

    const selected = await window.showQuickPick(items as QuickPickItem[], {
      title: UI_TEXT.TITLES.SELECT_PROVIDER,
      placeHolder: UI_TEXT.PLACEHOLDERS.SELECT_PROVIDER
    })

    if (!selected) return

    await addAccount((selected as any).providerId)
  }

  async function addAccount(providerId: ProviderId) {
    let credential: string

    if (providerId === 'google-antigravity') {
      credential = await loginWithAntigravity()
    } else if (providerId === 'github-copilot') {
      credential = await loginWithGitHub()
    } else if (providerId === 'gemini-cli') {
      credential = await loginWithGeminiCli()
    } else {
      credential = await loginWithApiKey(providerId as 'zhipu' | 'zai' | 'kimi-code')
    }

    const alias = await inputAlias()
    if (alias === undefined) return

    await addAccountToConfig(providerId, credential, alias)
  }

  async function showAccountActions(accountId: string) {
    const account = getAccounts().find((a) => a.id === accountId)
    if (!account) return

    const providerDef = getProviderDefinition(account.providerId)
    const accountLabel = account.alias || accountId

    const items = [
      { label: UI_TEXT.ACTIONS.BACK, action: 'back' },
      { label: '', kind: QuickPickItemKind.Separator },
      {
        label: UI_TEXT.ACTIONS.NAME,
        description: UI_TEXT.ACTIONS.NAME_DESC,
        action: 'setAlias'
      },
      {
        label: UI_TEXT.ACTIONS.RELOGIN,
        description: UI_TEXT.ACTIONS.RELOGIN_DESC,
        action: 'relogin'
      },
      {
        label: UI_TEXT.ACTIONS.LOGOUT,
        description: UI_TEXT.ACTIONS.LOGOUT_DESC,
        action: 'logout'
      }
    ]

    const selected = await window.showQuickPick(items, {
      title: `${providerDef?.name || account.providerId} - ${accountLabel}`,
      placeHolder: UI_TEXT.PLACEHOLDERS.SELECT_ACTION
    })

    if (!selected) return

    if (selected.action === 'back') {
      await showAccountMenu()
    } else if (selected.action === 'setAlias') {
      await setAccountAlias(accountId)
    } else if (selected.action === 'relogin') {
      await reloginAccount(accountId)
    } else if (selected.action === 'logout') {
      await deleteAccount(accountId)
    }
  }

  async function setAccountAlias(accountId: string) {
    const account = getAccounts().find((a) => a.id === accountId)
    if (!account) return

    const alias = await window.showInputBox({
      title: UI_TEXT.TITLES.ACCOUNT_NAME,
      prompt: UI_TEXT.PROMPTS.SET_NAME,
      value: account.alias || '',
      placeHolder: UI_TEXT.PLACEHOLDERS.CURRENT_NAME(account.alias || 'None')
    })

    if (alias === undefined) return

    await updateAccountName(accountId, alias)
  }

  async function reloginAccount(accountId: string) {
    const account = getAccounts().find((a) => a.id === accountId)
    if (!account) return

    let credential: string

    if (account.providerId === 'google-antigravity') {
      credential = await loginWithAntigravity()
    } else if (account.providerId === 'gemini-cli') {
      credential = await loginWithGeminiCli()
    } else {
      credential = await loginWithApiKey(account.providerId as 'zhipu' | 'zai')
    }

    await updateCredential(accountId, credential)
  }

  async function deleteAccount(accountId: string) {
    const account = getAccounts().find((a) => a.id === accountId)
    if (!account) return

    const providerDef = getProviderDefinition(account.providerId)
    const accountLabel = account.alias || accountId
    const providerName = providerDef?.name || account.providerId

    const confirmAction = await window.showWarningMessage(
      UI_MESSAGES.ACCOUNT.LOGOUT_CONFIRM(providerName, accountLabel),
      'Confirm',
      'Cancel'
    )

    if (confirmAction !== 'Confirm') {
      await showAccountMenu()
      return
    }

    await deleteAccountConfig(accountId)

    window.showInformationMessage(
      UI_MESSAGES.ACCOUNT.LOGGED_OUT(providerName, accountLabel)
    )

    await showAccountMenu()
  }

  async function inputAlias(): Promise<string | undefined> {
    return window.showInputBox({
      title: UI_TEXT.TITLES.ACCOUNT_ALIAS,
      prompt: UI_TEXT.PROMPTS.SET_ALIAS,
      placeHolder: UI_TEXT.PLACEHOLDERS.ALIAS_EXAMPLE
    })
  }

  return {
    view,
    showAccountMenu
  }
}
