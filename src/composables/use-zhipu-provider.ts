/* eslint-disable @typescript-eslint/naming-convention */
import { defineService } from 'reactive-vscode'
import { useBigModelProvider } from './use-big-model-provider'

export const useZhipuProvider = defineService(() => useBigModelProvider({
  id: 'zhipu',
  name: 'Zhipu AI',
  keyPrefix: 'sk.',
  apiUrl: 'https://bigmodel.cn/api/monitor/usage/quota/limit',
}))
