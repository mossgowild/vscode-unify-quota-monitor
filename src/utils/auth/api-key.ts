import { env, window, Uri } from 'vscode'

export async function loginWithApiKey(
  providerId: 'zhipu' | 'zai'
): Promise<string> {
  const config: Record<string, any> = {
    zhipu: {
      providerName: 'Zhipu AI',
      helpUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
      prefix: 'sk.',
      buttonTextKey: 'Open docs to get Key'
    },
    zai: {
      providerName: 'Z.ai',
      helpUrl: 'https://zai.sh/',
      prefix: 'zai_',
      buttonTextKey: 'Open website to get Key'
    }
  }

  const providerConfig = config[providerId]

  const openDocsAction = await window.showInformationMessage(
    `${providerConfig.providerName} API Key`,
    providerConfig.buttonTextKey
  )

  if (openDocsAction) {
    await env.openExternal(Uri.parse(providerConfig.helpUrl))
  }

  const apiKey = await window.showInputBox({
    title: `Enter ${providerConfig.providerName} API Key`,
    prompt: `Format: ${providerConfig.prefix}xxxxxxxxx (starts with ${providerConfig.prefix})`,
    password: true,
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (!value?.trim()) {
        return 'API Key cannot be empty'
      }
      if (!value.startsWith(providerConfig.prefix)) {
        return `Invalid API Key format, should start with ${providerConfig.prefix}`
      }
      return null
    }
  })

  if (!apiKey) {
    throw new Error('Canceled')
  }

  return apiKey
}
