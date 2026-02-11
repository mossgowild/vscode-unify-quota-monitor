import type { ProviderDefinition, ProviderId } from './types'
import { PROVIDERS, UI_TEXT } from './constants'

function getProviderDefinitions(): ProviderDefinition[] {
  return [
    {
      id: PROVIDERS.ZHIPU.ID,
      name: PROVIDERS.ZHIPU.NAME,
      auth: {
        required: true,
        type: 'key',
        placeholder: UI_TEXT.PLACEHOLDERS.ENTER_KEY(PROVIDERS.ZHIPU.NAME),
      },
    },
    {
      id: PROVIDERS.ZAI.ID,
      name: PROVIDERS.ZAI.NAME,
      auth: {
        required: true,
        type: 'key',
        placeholder: UI_TEXT.PLACEHOLDERS.ENTER_KEY(PROVIDERS.ZAI.NAME),
      },
    },
    {
      id: PROVIDERS.ANTIGRAVITY.ID,
      name: PROVIDERS.ANTIGRAVITY.NAME,
      auth: {
        required: true,
        type: 'oauth',
        placeholder: UI_TEXT.PLACEHOLDERS.LOGIN_OAUTH('Antigravity'),
      },
    },
    {
      id: PROVIDERS.GITHUB.ID,
      name: PROVIDERS.GITHUB.NAME,
      auth: {
        required: true,
        type: 'oauth',
        placeholder: UI_TEXT.PLACEHOLDERS.LOGIN_OAUTH('GitHub'),
      },
    },
    {
      id: PROVIDERS.GEMINI.ID,
      name: PROVIDERS.GEMINI.NAME,
      auth: {
        required: true,
        type: 'oauth',
        placeholder: UI_TEXT.PLACEHOLDERS.LOGIN_OAUTH('Gemini CLI'),
      },
    },
    {
      id: PROVIDERS.KIMI.ID,
      name: PROVIDERS.KIMI.NAME,
      auth: {
        required: true,
        type: 'key',
        placeholder: UI_TEXT.PLACEHOLDERS.ENTER_KEY(PROVIDERS.KIMI.NAME),
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
