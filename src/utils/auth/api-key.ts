import { env, window, Uri } from 'vscode'
import { ERROR_MESSAGES, PROVIDERS, UI_TEXT } from '../../constants'

export async function loginWithApiKey(
  providerId: 'zhipu' | 'zai' | 'kimi-code'
): Promise<string> {
  const config: Record<string, any> = {
    zhipu: {
      providerName: PROVIDERS.ZHIPU.NAME,
      helpUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
      prefix: 'sk.',
      buttonTextKey: UI_TEXT.ACTIONS.OPEN_DOCS
    },
    zai: {
      providerName: PROVIDERS.ZAI.NAME,
      helpUrl: 'https://zai.sh/',
      prefix: 'zai_',
      buttonTextKey: UI_TEXT.ACTIONS.OPEN_WEBSITE
    },
    'kimi-code': {
      providerName: PROVIDERS.KIMI.NAME,
      helpUrl: '',
      prefix: 'sk-kimi',
      buttonTextKey: ''
    }
  }

  const providerConfig = config[providerId]

  // Show help button only if helpUrl is provided
  if (providerConfig.helpUrl && providerConfig.buttonTextKey) {
    const openDocsAction = await window.showInformationMessage(
      UI_TEXT.TITLES.API_KEY_INFO(providerConfig.providerName),
      providerConfig.buttonTextKey
    )

    if (openDocsAction) {
      await env.openExternal(Uri.parse(providerConfig.helpUrl))
    }
  }

  const apiKey = await window.showInputBox({
    title: UI_TEXT.TITLES.ENTER_KEY(providerConfig.providerName),
    prompt: UI_TEXT.PROMPTS.KEY_FORMAT(providerConfig.prefix),
    password: true,
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (!value?.trim()) {
        return ERROR_MESSAGES.AUTH.API_KEY_EMPTY
      }
      if (!value.startsWith(providerConfig.prefix)) {
        return ERROR_MESSAGES.AUTH.API_KEY_INVALID(providerConfig.prefix)
      }
      return null
    }
  })

  if (!apiKey) {
    throw new Error(ERROR_MESSAGES.AUTH.CANCELED)
  }

  return apiKey
}
