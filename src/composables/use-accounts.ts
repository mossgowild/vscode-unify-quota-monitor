import { computed } from 'reactive-vscode'
import { ConfigurationTarget } from 'vscode'
import type { ProviderId, Account } from '../types'
import { useConfig } from './use-config'

export function useAccounts() {
  const config = useConfig()

  // Runtime view of all accounts flattened
  // ID format: "${providerIndex}:${accountIndex}"
  // This allows O(1) lookup for updates/deletes and stable references
  const accounts = computed(() => {
    const list: (Account & { providerId: ProviderId })[] = []
    const providers = config.providers || []

    providers.forEach((p, pIndex) => {
      p.accounts.forEach((a, aIndex) => {
        list.push({
          id: `${pIndex}:${aIndex}`,
          providerId: p.provider, // Helper for filtering
          alias: a.name,
          credential: a.credential,
          usage: [], // Initial empty usage
          lastUpdated: new Date().toISOString()
        })
      })
    })
    return list
  })

  function getAccounts(): (Account & { providerId: ProviderId })[] {
    return accounts.value
  }

  function getAccountsByProvider(providerId: ProviderId): Account[] {
    return accounts.value.filter(a => a.providerId === providerId)
  }

  // Helper to parse ID
  function parseId(id: string): { pIndex: number, aIndex: number } | null {
    const parts = id.split(':')
    if (parts.length !== 2) return null
    const pIndex = parseInt(parts[0], 10)
    const aIndex = parseInt(parts[1], 10)
    if (isNaN(pIndex) || isNaN(aIndex)) return null
    return { pIndex, aIndex }
  }

  async function addAccount(
    providerId: ProviderId,
    credential: string,
    alias?: string
  ): Promise<void> {
    const providers = [...(config.providers || [])]
    let pConfig = providers.find(p => p.provider === providerId)
    
    if (!pConfig) {
      pConfig = { provider: providerId, accounts: [] }
      providers.push(pConfig)
    }

    pConfig.accounts.push({ credential, name: alias })
    await config.update('providers', providers, ConfigurationTarget.Global)
  }

  async function deleteAccount(accountId: string): Promise<void> {
    const indices = parseId(accountId)
    if (!indices) return

    const { pIndex, aIndex } = indices
    const providers = [...(config.providers || [])]
    
    if (providers[pIndex] && providers[pIndex].accounts[aIndex]) {
      providers[pIndex].accounts.splice(aIndex, 1)
      
      // Optional: Cleanup empty provider blocks
      if (providers[pIndex].accounts.length === 0) {
        providers.splice(pIndex, 1)
      }

      await config.update('providers', providers, ConfigurationTarget.Global)
    }
  }

  async function updateAccountName(accountId: string, newName: string): Promise<void> {
    const indices = parseId(accountId)
    if (!indices) return

    const { pIndex, aIndex } = indices
    const providers = [...(config.providers || [])]
    
    if (providers[pIndex] && providers[pIndex].accounts[aIndex]) {
      providers[pIndex].accounts[aIndex].name = newName
      await config.update('providers', providers, ConfigurationTarget.Global)
    }
  }

  async function updateCredential(accountId: string, newCredential: string): Promise<void> {
    const indices = parseId(accountId)
    if (!indices) return

    const { pIndex, aIndex } = indices
    const providers = [...(config.providers || [])]
    
    if (providers[pIndex] && providers[pIndex].accounts[aIndex]) {
      providers[pIndex].accounts[aIndex].credential = newCredential
      await config.update('providers', providers, ConfigurationTarget.Global)
    }
  }
  
  // Backwards compatibility for saveAccount (used for updating credential mainly)
  // But strictly speaking we should check usages.
  // The old saveAccount took a StoredAccount object.
  // We'll replace it with specific update methods.

  return {
    accounts,
    getAccounts,
    getAccountsByProvider,
    addAccount,
    deleteAccount,
    updateAccountName,
    updateCredential
  }
}
