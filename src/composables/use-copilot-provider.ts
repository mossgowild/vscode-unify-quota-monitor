/* eslint-disable @typescript-eslint/naming-convention */
import { defineService } from 'reactive-vscode'
import { useBaseProvider } from './use-base-provider'
import type { UsageItem } from '../types'

export const useCopilotProvider = defineService(() =>
  useBaseProvider({
    id: 'copilot',
    name: 'GitHub Copilot',
    fetchUsage: async (credential: string): Promise<UsageItem[]> => {
      const { authentication } = await import('vscode')
      const session = await authentication.getSession('github', ['read:user'], {
        createIfNone: false,
      })
      const githubToken = session?.accessToken || credential

      if (!githubToken) {
        throw new Error('No GitHub token available')
      }

      const response = await fetch('https://api.github.com/copilot_internal/user', {
        headers: {
          Authorization: `token ${githubToken}`,
          'User-Agent': 'GitHubCopilotChat/0.24.0',
          'Editor-Version': 'vscode/1.97.0',
          'Editor-Plugin-Version': 'copilot-chat/0.24.0',
          'Copilot-Integration-Id': 'vscode-chat',
          'X-GitHub-Api-Version': '2023-07-07',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch usage: ${response.statusText}`)
      }

      const data = await response.json() as {
        quota_snapshots?: {
          premium_interactions?: {
            entitlement?: number
            limit?: number
            remaining?: number
            reset_date?: string
            next_reset_date?: string
          }
        }
        premium_interactions?: {
          entitlement?: number
          limit?: number
          remaining?: number
          reset_date?: string
          next_reset_date?: string
        }
        user_copilot?: {
          premium_interactions?: {
            entitlement?: number
            limit?: number
            remaining?: number
            reset_date?: string
            next_reset_date?: string
          }
        }
      }

      const interactions =
        data.quota_snapshots?.premium_interactions ||
        data.premium_interactions ||
        data.user_copilot?.premium_interactions

      if (!interactions) {
        throw new Error('No usage data available')
      }

      const limit = interactions.entitlement || interactions.limit || 0
      const remaining = interactions.remaining || 0
      const used = limit - remaining

      return [
        {
          name: 'Premium Request',
          type: 'quantity',
          used,
          total: limit,
          resetTime: interactions.reset_date || interactions.next_reset_date,
        },
      ]
    },
    authenticate: async (): Promise<string> => {
      const { authentication } = await import('vscode')
      const session = await authentication.getSession('github', ['read:user'], {
        createIfNone: true,
      })
      if (!session) {
        throw new Error('GitHub authentication failed')
      }
      return session.accessToken
    },
  })
)
