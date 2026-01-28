import { computed } from 'reactive-vscode'
import { ConfigurationTarget } from 'vscode'
import type { ProviderId, StoredAccount } from '../types'
import { useConfig } from './use-config'

export function useAccounts() {
  const config = useConfig()
  const accounts = computed(() => config.accounts ?? [])

  function getAccounts(): StoredAccount[] {
    return accounts.value
  }

  function getAccount(accountId: string): StoredAccount | undefined {
    return accounts.value.find(a => a.id === accountId)
  }

  function getAccountsByProvider(providerId: ProviderId): StoredAccount[] {
    return accounts.value.filter(a => a.providerId === providerId)
  }

  async function saveAccount(account: StoredAccount): Promise<void> {
    const list = [...accounts.value]
    const index = list.findIndex(a => a.id === account.id)

    if (index >= 0) {
      list[index] = account
    } else {
      list.push(account)
    }

    await config.update('accounts', list, ConfigurationTarget.Global)
  }

  async function deleteAccount(accountId: string): Promise<void> {
    const list = accounts.value.filter(a => a.id !== accountId)
    await config.update('accounts', list, ConfigurationTarget.Global)
  }

  async function addAccount(
    providerId: ProviderId,
    credential: string,
    alias?: string
  ): Promise<string> {
    const id = `${providerId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
    const account: StoredAccount = { id, providerId, credential, alias }
    await saveAccount(account)
    return id
  }

  return {
    accounts,
    getAccounts,
    getAccount,
    getAccountsByProvider,
    saveAccount,
    deleteAccount,
    addAccount,
  }
}
