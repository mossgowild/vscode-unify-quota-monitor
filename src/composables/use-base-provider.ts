import { computed, DeepReadonly, ref, type ComputedRef } from 'reactive-vscode'
import { useConfig } from './use-config'
import type {
  ProviderId,
  UsageItem,
  ViewAccount,
  ConfigAccount
} from '../types'

export interface BaseProviderOptions {
  id: ProviderId
  name: string
  fetchUsage: (credential: string) => Promise<UsageItem[]>
  authenticate: () => Promise<string>
}

export interface UseBaseProviderReturn {
  id: ProviderId
  name: string
  accounts: ComputedRef<ViewAccount[]>
  login: () => Promise<void>
  logout: (accountIndex: number) => void
  refresh: (accountIndex?: number) => Promise<void>
  rename: (accountIndex: number, name: string) => void
}

export function useBaseProvider(
  options: BaseProviderOptions
): UseBaseProviderReturn {
  const config = useConfig()
  const key = `providers.${options.id}`
  const accountsConfig = computed({
    get() {
      return (
        config.has(key) ? config.providers[options.id] : []
      ) as DeepReadonly<ConfigAccount[]>
    },
    set(value: ConfigAccount[]) {
      config.update(key, value.length > 0 ? value : undefined)
    }
  })
  const accountsData = ref<{ usage?: UsageItem[]; error?: string }[]>([])
  const accounts = computed((): ViewAccount[] => {
    return accountsConfig.value.map((account, index) => ({
      name: account.name ?? `${options.name} #${index + 1}`,
      usage: accountsData.value[index]?.usage ?? [],
      error: accountsData.value[index]?.error
    }))
  })

  const login = async () => {
    const credential = await options.authenticate()
    accountsConfig.value = [...accountsConfig.value, { credential }]
    refresh(accountsConfig.value.length - 1)
  }

  const logout = (accountIndex: number) => {
    accountsConfig.value = accountsConfig.value.filter(
      (_, i) => i !== accountIndex
    )
    accountsData.value.splice(accountIndex, 1)
  }

  const refresh = async (accountIndex?: number) => {
    const indices =
      accountIndex !== undefined
        ? [accountIndex]
        : accountsConfig.value.map((_, i) => i)
    await Promise.allSettled(
      indices.map(async (idx) => {
        const account = accountsConfig.value[idx]
        if (!account) return
        try {
          const usage = await options.fetchUsage(account.credential)
          accountsData.value[idx] = { usage }
        } catch (e: any) {
          accountsData.value[idx] = { error: e.message || 'Unknown error' }
        }
      })
    )
  }

  const rename = (accountIndex: number, name: string) => {
    accountsConfig.value = accountsConfig.value.map((acc, i) =>
      i === accountIndex ? { ...acc, name } : acc
    )
  }

  return {
    id: options.id,
    name: options.name,
    accounts,
    login,
    logout,
    refresh,
    rename
  }
}
