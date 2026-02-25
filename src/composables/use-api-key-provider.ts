import { window } from 'vscode'
import { useBaseProvider } from './use-base-provider'
import type { ProviderId, UsageItem } from '../types'

export interface ApiKeyProviderOptions {
  id: ProviderId
  name: string
  fetchUsage: (credential: string) => Promise<UsageItem[]>
  keyPrefix?: string
  placeholder?: string
}

export function useApiKeyProvider(options: ApiKeyProviderOptions) {
  const authenticate = async () => {
    const keyPrefix = options.keyPrefix || 'sk'

    const apiKey = await window.showInputBox({
      title: `Enter ${options.name} API Key`,
      prompt: `Format: ${keyPrefix}...`,
      password: true,
      ignoreFocusOut: true,
      placeHolder: options.placeholder || `${keyPrefix}...`,
      validateInput: (value: string) => {
        if (!value?.trim()) {
          return 'API Key is required'
        }
        if (!value.startsWith(keyPrefix)) {
          return `Key must start with ${keyPrefix}`
        }
        return null
      },
    })

    if (!apiKey) {
      throw new Error('Authentication cancelled')
    }

    return apiKey.trim()
  }

  return useBaseProvider({
    id: options.id,
    name: options.name,
    fetchUsage: options.fetchUsage,
    authenticate
  })
}
