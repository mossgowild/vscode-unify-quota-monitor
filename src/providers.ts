import type { ProviderDefinition, ProviderId } from './types'
import { t } from './i18n'

function getProviderDefinitions(): ProviderDefinition[] {
  return [
    {
      id: 'openai',
      name: 'OpenAI',
      auth: {
        required: true,
        type: 'token',
        placeholder: t('Enter OpenAI Access Token (JWT)'),
      },
    },
    {
      id: 'zhipu',
      name: t('Zhipu AI'),
      auth: {
        required: true,
        type: 'key',
        placeholder: t('Enter Zhipu AI Key'),
      },
    },
    {
      id: 'zai',
      name: 'Z.ai',
      auth: {
        required: true,
        type: 'key',
        placeholder: t('Enter Z.ai Key'),
      },
    },
    {
      id: 'google',
      name: 'Google Antigravity',
      auth: {
        required: true,
        type: 'oauth',
        placeholder: t('Login via OAuth'),
      },
    },
  ]
}

export function getProviderDefinition(id: ProviderId): ProviderDefinition | undefined {
  return getProviderDefinitions().find(p => p.id === id)
}

export function getAllProviderDefinitions(): ProviderDefinition[] {
  return getProviderDefinitions()
}
