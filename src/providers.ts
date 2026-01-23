import type { ProviderDefinition, ProviderId } from './types'
import { t } from './i18n'

function getProviderDefinitions(): ProviderDefinition[] {
  return [
    {
      id: 'openai',
      name: 'OpenAI',
      icon: 'symbol-event',
      auth: {
        required: true,
        type: 'token',
        placeholder: t('Enter OpenAI Access Token (JWT)'),
        helpUrl: 'https://chatgpt.com/',
      },
    },
    {
      id: 'zhipu',
      name: t('Zhipu AI'),
      icon: 'zap',
      auth: {
        required: true,
        type: 'key',
        placeholder: t('Enter Zhipu AI Key'),
        helpUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
      },
    },
    {
      id: 'zai',
      name: 'Z.ai',
      icon: 'beaker',
      auth: {
        required: true,
        type: 'key',
        placeholder: t('Enter Z.ai Key'),
        helpUrl: 'https://zai.sh/',
      },
    },
    {
      id: 'google',
      name: 'Google Antigravity',
      icon: 'globe',
      auth: {
        required: true,
        type: 'oauth',
        placeholder: t('Login via OAuth'),
        helpUrl: 'https://github.com/anthropics/anthropic-quickstarts',
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
