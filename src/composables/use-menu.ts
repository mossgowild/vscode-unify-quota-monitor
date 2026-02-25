import { defineService } from 'reactive-vscode'
import { QuickPickItemKind, window } from 'vscode'
import type { ProviderId } from '../types'
import { useProviders } from './use-providers'

export const useMenu = defineService(() => {
  const { providersMap } = useProviders()
  async function showAccountMenu(): Promise<void> {
    const items: {
      label: string
      description?: string
      providerId?: ProviderId
      accountIndex?: number
    }[] = []

    for (const providerId of Object.keys(providersMap) as ProviderId[]) {
      const accounts = providersMap[providerId].accounts.value
      if (accounts.length === 0) continue
      const providerName = providersMap[providerId].name
      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i]
        const hasMultiple = accounts.length > 1
        items.push({
          label: providerName,
          description: hasMultiple ? acc.name : undefined,
          providerId,
          accountIndex: i
        })
      }
    }

    if (items.length > 0) {
      items.push({ label: '', description: '' })
    }
    items.push({
      label: 'Add Account',
      description: 'Add a new provider account'
    })

    const selected = await window.showQuickPick(items, {
      title: 'Settings',
      placeHolder: 'Manage your provider accounts'
    })
    if (!selected) return

    if (
      selected.providerId !== undefined &&
      selected.accountIndex !== undefined
    ) {
      await showAccountActions(selected.providerId, selected.accountIndex)
    } else if (selected.label === 'Add Account') {
      const providerItems = (Object.keys(providersMap) as ProviderId[]).map(
        (id) => ({ label: providersMap[id].name, providerId: id })
      )
      const providerSelected = await window.showQuickPick(providerItems, {
        title: 'Select Provider',
        placeHolder: 'Choose a provider to add'
      })
      if (providerSelected?.providerId)
        await providersMap[providerSelected.providerId].login()
    }
  }

  async function showAccountActions(
    providerId: ProviderId,
    accountIndex: number
  ): Promise<void> {
    const providerName = providersMap[providerId].name
    const accounts = providersMap[providerId].accounts.value
    const account = accounts[accountIndex]
    if (!account) return

    const actions = [
      { label: '← Back' },
      { label: '', kind: QuickPickItemKind.Separator },
      {
        label: '$(edit) Set Name',
        description: 'Change the display name for this account'
      },
      { label: '$(trash) Logout', description: 'Remove this account' }
    ]

    const selected = await window.showQuickPick(actions, {
      title: `${providerName} - ${account.name}`,
      placeHolder: 'Select an action'
    })
    if (!selected) return

    if (selected.label === '← Back') {
      await showAccountMenu()
    } else if (selected.label === '$(edit) Set Name') {
      const name = await window.showInputBox({
        title: 'Account Name',
        prompt: 'Enter a display name for this account',
        value: account.name,
        placeHolder: `Current: ${account.name}`
      })
      if (name !== undefined)
        providersMap[providerId].rename(accountIndex, name)
    } else if (selected.label === '$(trash) Logout') {
      const confirmed = await window.showWarningMessage(
        `Logout from ${providerName} - ${account.name}?`,
        'Confirm',
        'Cancel'
      )
      if (confirmed !== 'Confirm') {
        await showAccountMenu()
        return
      }
      providersMap[providerId].logout(accountIndex)
      window.showInformationMessage(
        `Logged out from ${providerName} - ${account.name}`
      )
      await showAccountMenu()
    }
  }

  return { showAccountMenu, showAccountActions }
})
