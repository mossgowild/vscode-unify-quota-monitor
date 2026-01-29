import type { ProviderDefinition, ProviderId } from './types'

function getProviderDefinitions(): ProviderDefinition[] {
  return [
    {
      id: 'openai',
      name: 'OpenAI',
      auth: {
        required: true,
        type: 'token',
        placeholder: 'Enter OpenAI Access Token (JWT)',
      },
    },
    {
      id: 'zhipu',
      name: 'Zhipu AI',
      auth: {
        required: true,
        type: 'key',
        placeholder: 'Enter Zhipu AI Key',
      },
    },
    {
      id: 'zai',
      name: 'Z.ai',
      auth: {
        required: true,
        type: 'key',
        placeholder: 'Enter Z.ai Key',
      },
    },
    {
      id: 'google-antigravity',
      name: 'Google Antigravity',
      auth: {
        required: true,
        type: 'oauth',
        placeholder: 'Login with Antigravity OAuth',
      },
    },
    {
      id: 'github-copilot',
      name: 'GitHub Copilot',
      auth: {
        required: true,
        type: 'oauth',
        placeholder: 'Login with GitHub OAuth',
      },
    },
    {
      id: 'gemini-cli',
      name: 'Gemini CLI',
      auth: {
        required: true,
        type: 'oauth',
        placeholder: 'Login with Gemini CLI OAuth',
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
