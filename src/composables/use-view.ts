import { computed, useWebviewView } from 'reactive-vscode'
import { env, QuickPickItemKind, QuickPickItem, window, ConfigurationTarget } from 'vscode'
import type { ProviderId } from '../types'
import { getAllProviderDefinitions, getProviderDefinition } from '../providers'
import { t } from '../i18n'
import { useUsage } from './use-usage'
import { config } from './use-config'
import { loginWithGoogle, loginWithOpenAI, loginWithOpenAIToken, loginWithApiKey } from '../utils/auth-helpers'

export function useView() {
  const { providers, hasLoadedOnce } = useUsage()

  const html = computed(() => {
    const providerList = providers.value
    const hasAccounts = providerList.some(p => p.accounts && p.accounts.length > 0)
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
                padding: 0 1em 1em 1em;
                display: flex;
                flex-direction: column;
            }

            .provider-section {
                margin-bottom: 1.2em;
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 1em;
            }
            
            .provider-section:last-child {
                margin-bottom: 0;
                border-bottom: none;
            }
            
            .provider-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.5em 0;
                font-weight: 600;
                font-size: 0.95em;
                color: var(--vscode-foreground);
                margin-bottom: 0.5em;
            }
            
            .account-block {
                margin-bottom: 0.8em;
                padding: 0.6em;
                background: var(--vscode-editor-background);
                border-radius: 3px;
            }
            
            .account-label {
                font-size: 0.85em;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 0.4em;
                font-weight: 500;
            }
            
            .usage-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 0.6em;
            }
            
            .usage-item {
                padding: 0.2em 0;
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
                background-color: var(--vscode-scrollbarSlider-background);
                border-radius: 2px;
                overflow: hidden;
                margin-bottom: 0.2em;
            }
            
            .progress-bar {
                height: 100%;
                background-color: var(--vscode-charts-blue);
                transition: width 0.2s ease;
            }
            
            .progress-bar.warning {
                background-color: var(--vscode-charts-yellow);
            }
            
            .progress-bar.danger {
                background-color: var(--vscode-charts-red);
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
            (function() {
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
                            const hours = Math.floor(diffMs / 3600000);
                            const mins = Math.floor((diffMs % 3600000) / 60000);
                            const secs = Math.floor((diffMs % 60000) / 1000);
                            
                            let timeStr = '';
                            if (hours > 0) {
                                timeStr = hours + 'h ' + mins + 'm';
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
    const title = t('No Active Account')
    const description = t('Click icon buttons in the top right to manage accounts')

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
      .filter(p => p.accounts && Array.isArray(p.accounts) && p.accounts.length > 0)
      .map(p => renderProvider(p, locale))
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

  function renderAccount(account: any, locale: string, showLabel: boolean): string {
    const accountLabel = account.alias || account.id

    if (!showLabel) {
      return `
          <div class="account-block">
              <div class="usage-grid">
                  ${account.usage.map((u: any) => renderUsageItem(u)).join('')}
              </div>
          </div>
      `
    }

    return `
        <div class="account-block">
            <div class="account-label">${accountLabel}</div>
            <div class="usage-grid">
                ${account.usage.map((u: any) => renderUsageItem(u)).join('')}
            </div>
        </div>
    `
  }

  function renderUsageItem(usage: any): string {
    const percentage = usage.total > 0 ? (usage.used / usage.total) : 0
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
      const unit = usage.limitType === 'request' ? '' : ` ${t('credits')}`
      displayValue = `${usage.used} / ${usage.total}${unit}`
    }

    let resetHtml = ''
    if (usage.resetTime) {
      const date = new Date(usage.resetTime)
      const now = new Date()
      const diffMs = date.getTime() - now.getTime()
      let resetText = ''

      if (diffMs > 0) {
        const resetTemplate = t('Resets in {time}', { time: '{{TIME}}' })
        const hours = Math.floor(diffMs / 3600000)
        const mins = Math.floor((diffMs % 3600000) / 60000)
        const secs = Math.floor((diffMs % 60000) / 1000)

        let timeStr = ''
        if (hours > 0) {
          timeStr = `${hours}h ${mins}m`
        } else {
          timeStr = `${mins}m ${secs}s`
        }
        resetText = resetTemplate.replace('{{TIME}}', timeStr)

        const safeTemplate = resetTemplate.replace(/"/g, '&quot;')
        resetHtml = `<div class="usage-reset" data-reset-time="${usage.resetTime}" data-template="${safeTemplate}">${resetText}</div>`
      } else {
        resetText = t('Resetting...')
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
      enableScripts: true,
    },
  })

  async function showAccountMenu() {
    const accounts = config.accounts ?? []
    
    const items: (QuickPickItem & { action?: string; accountId?: string; providerId?: ProviderId })[] = []

    if (accounts.length > 0) {
      for (const account of accounts) {
        const providerDef = getProviderDefinition(account.providerId)
        const accountLabel = account.alias || account.id
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
      label: `$(plus) ${t('Add Provider')}`,
      description: t('Login to new AI Provider'),
      action: 'addProvider'
    } as any)

    const selected = await window.showQuickPick(items as QuickPickItem[], {
      title: t('Manage Accounts'),
      placeHolder: t('Manage accounts or add new Provider')
    })

    if (!selected) return

    if ((selected as any).action === 'addProvider') {
      await addProviderAccount()
    } else if ((selected as any).action === 'manageAccount' && (selected as any).accountId) {
      await showAccountActions((selected as any).accountId)
    }
  }

  async function addProviderAccount() {
    const providers = getAllProviderDefinitions()
    const items = providers.map((p) => ({
      label: p.name,
      description:
        p.auth.type === 'oauth'
          ? 'OAuth Login'
          : p.auth.type === 'key'
            ? 'API Key'
            : 'Access Token',
      providerId: p.id
    } as QuickPickItem & { providerId: ProviderId }))

    const selected = await window.showQuickPick(items as QuickPickItem[], {
      title: t('Select Provider'),
      placeHolder: t('Select AI Provider to add')
    })

    if (!selected) return

    await addAccount((selected as any).providerId)
  }

  async function addAccount(providerId: ProviderId) {
    let credential: string

    if (providerId === 'google') {
      credential = await loginWithGoogle()
    } else if (providerId === 'openai') {
      const method = await selectOpenAIMethod()
      if (!method) return

      if (method === 'oauth') {
        credential = await loginWithOpenAI()
      } else {
        credential = await loginWithOpenAIToken()
      }
    } else {
      credential = await loginWithApiKey(providerId as 'zhipu' | 'zai')
    }

    const alias = await inputAlias()
    if (alias === undefined) return

    const list = [...(config.accounts ?? [])]
    const id = `${providerId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
    list.push({ id, providerId, credential, alias })
    await config.update('accounts', list, ConfigurationTarget.Global)
  }

  async function showAccountActions(accountId: string) {
    const account = (config.accounts ?? []).find(a => a.id === accountId)
    if (!account) return

    const providerDef = getProviderDefinition(account.providerId)
    const accountLabel = account.alias || accountId

    const items = [
      { label: `$(arrow-left) ${t('Back')}`, action: 'back' },
      { label: '', kind: QuickPickItemKind.Separator },
      {
        label: `$(pencil) ${t('Set Alias')}`,
        description: t('Modify account alias'),
        action: 'setAlias'
      },
      {
        label: `$(sign-in) ${t('Relogin')}`,
        description: t("Update this account's credentials"),
        action: 'relogin'
      },
      {
        label: `$(sign-out) ${t('Logout')}`,
        description: t('Delete this account'),
        action: 'logout'
      }
    ]

    const selected = await window.showQuickPick(items, {
      title: `${providerDef?.name || account.providerId} - ${accountLabel}`,
      placeHolder: t('Select action')
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
    const account = (config.accounts ?? []).find(a => a.id === accountId)
    if (!account) return

    const alias = await window.showInputBox({
      title: t('Account Alias'),
      prompt: t('Set an alias for this account'),
      value: account.alias || '',
      placeHolder: `${t('Current alias')}: ${account.alias || t('None')}`
    })

    if (alias === undefined) return

    const list = (config.accounts ?? []).map(a => 
      a.id === accountId ? { ...a, alias: alias || undefined } : a
    )
    await config.update('accounts', list, ConfigurationTarget.Global)
  }

  async function reloginAccount(accountId: string) {
    const account = (config.accounts ?? []).find(a => a.id === accountId)
    if (!account) return

    let credential: string

    if (account.providerId === 'google') {
      credential = await loginWithGoogle()
    } else if (account.providerId === 'openai') {
      const method = await selectOpenAIMethod()
      if (!method) return

      if (method === 'oauth') {
        credential = await loginWithOpenAI()
      } else {
        credential = await loginWithOpenAIToken()
      }
    } else {
      credential = await loginWithApiKey(account.providerId as 'zhipu' | 'zai')
    }

    const list = (config.accounts ?? []).map(a => 
      a.id === accountId ? { ...a, credential } : a
    )
    await config.update('accounts', list, ConfigurationTarget.Global)
  }

  async function deleteAccount(accountId: string) {
    const account = (config.accounts ?? []).find(a => a.id === accountId)
    if (!account) return

    const providerDef = getProviderDefinition(account.providerId)
    const accountLabel = account.alias || accountId
    const providerName = providerDef?.name || account.providerId

    const confirmAction = await window.showWarningMessage(
      t(
        'Are you sure you want to logout from {providerName} - {accountLabel}?',
        { providerName, accountLabel }
      ),
      t('Confirm'),
      t('Cancel')
    )

    if (confirmAction !== t('Confirm')) {
      await showAccountMenu()
      return
    }

    const list = (config.accounts ?? []).filter(a => a.id !== accountId)
    await config.update('accounts', list, ConfigurationTarget.Global)

    window.showInformationMessage(
      t('Logged out from {providerName} - {accountLabel}', {
        providerName,
        accountLabel
      })
    )

    await showAccountMenu()
  }

  async function selectOpenAIMethod(): Promise<'oauth' | 'token' | null> {
    const items = [
      {
        label: t('OAuth Login (Recommended)'),
        description: t('For ChatGPT Plus/Pro'),
        detail: 'oauth'
      },
      {
        label: 'Access Token',
        description: t('Manually enter JWT Token'),
        detail: 'token'
      }
    ]

    const selected = await window.showQuickPick(items, {
      placeHolder: t('Select Login Method')
    })

    if (!selected) return null
    return selected.detail as 'oauth' | 'token'
  }

  async function inputAlias(): Promise<string | undefined> {
    return window.showInputBox({
      title: t('Account Alias (Optional)'),
      prompt: t('Set an alias for this account to distinguish multiple accounts'),
      placeHolder: t('e.g. Work, Personal, Team, etc.'),
    })
  }

  return {
    view,
    showAccountMenu,
  }
}
