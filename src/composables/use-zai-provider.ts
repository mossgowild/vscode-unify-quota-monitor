/* eslint-disable @typescript-eslint/naming-convention */
import { defineService } from 'reactive-vscode'
import { useBigModelProvider } from './use-big-model-provider'

export const useZaiProvider = defineService(() => useBigModelProvider({
  id: 'zai',
  name: 'Z.AI',
  keyPrefix: 'zai_',
  apiUrl: 'https://api.z.ai/api/monitor/usage/quota/limit',
}))
