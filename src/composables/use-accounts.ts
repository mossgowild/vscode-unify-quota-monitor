import { computed } from 'reactive-vscode'
import { ConfigurationTarget } from 'vscode'
import type { ProviderId, StoredAccount } from '../types'
import { config } from './use-config'

export function useAccounts() {
  const accounts = computed(() => config.accounts ?? [])

  function getStoredAccounts(): StoredAccount[] {
    return accounts.value
  }

  function getAccount(accountId: string): StoredAccount | undefined {
    return accounts.value.find(a => a.id === accountId)
  }

  function getAccountsByProvider(providerId: ProviderId): StoredAccount[] {
    return accounts.value.filter(a => a.providerId === providerId)
  }

  function generateAccountId(providerId: ProviderId): string {
    return `${providerId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
  }

  function hasStoredAccounts(): boolean {
    return accounts.value.length > 0
  }

  async function saveAccount(account: StoredAccount): Promise<void> {
    const list = [...accounts.value]
    const index = list.findIndex(a => a.id === account.id)

    if (index >= 0) {
      list[index] = account
    }
    else {
      list.push(account)
    }

    await config.update('accounts', list, ConfigurationTarget.Global)
  }

  async function deleteAccount(accountId: string): Promise<void> {
    const list = accounts.value.filter(a => a.id !== accountId)
    await config.update('accounts', list, ConfigurationTarget.Global)
  }

  return {
    accounts,
    getStoredAccounts,
    getAccount,
    getAccountsByProvider,
    generateAccountId,
    hasStoredAccounts,
    saveAccount,
    deleteAccount,
  }
}
