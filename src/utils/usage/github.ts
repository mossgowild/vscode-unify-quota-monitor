import type { FetchUsageResult, UsageCategory } from '../../types'
import { getGitHubAccessToken } from '../auth/github'
import { ERROR_MESSAGES } from '../../constants'

export async function fetchGitHubCopilotUsage(): Promise<FetchUsageResult> {
  const githubToken = await getGitHubAccessToken()
  if (!githubToken) {
    return {
      success: false,
      usage: [],
      error: ERROR_MESSAGES.AUTH.NO_GITHUB_TOKEN,
      lastUpdated: new Date().toISOString()
    }
  }

  try {
    const response = await fetch(
      'https://api.github.com/copilot_internal/user',
      {
        headers: {
          Authorization: `token ${githubToken}`,
          'User-Agent': 'GitHubCopilotChat/0.24.0',
          'Editor-Version': 'vscode/1.97.0',
          'Editor-Plugin-Version': 'copilot-chat/0.24.0',
          'Copilot-Integration-Id': 'vscode-chat',
          'X-GitHub-Api-Version': '2023-07-07'
        }
      }
    )

    if (!response.ok) {
      return {
        success: false,
        usage: [],
        error: ERROR_MESSAGES.API.REQUEST_FAILED(response.status, response.statusText),
        lastUpdated: new Date().toISOString()
      }
    }

    const data = (await response.json()) as any
    const usage: UsageCategory[] = []

    const interactions =
      data.quota_snapshots?.premium_interactions ||
      data.premium_interactions ||
      data.user_copilot?.premium_interactions

    if (interactions) {
      const limit = interactions.entitlement || interactions.limit || 0
      const remaining = interactions.remaining || 0
      const used = limit - remaining

      usage.push({
        name: 'Premium Request',
        limitType: 'request',
        used: used,
        total: limit,
        resetTime: interactions.reset_date || interactions.next_reset_date
      })
    } else {
      const keys = Object.keys(data).join(', ')
      return {
        success: false,
        usage: [],
        error: ERROR_MESSAGES.API.NO_DATA(`Keys: ${keys}`),
        lastUpdated: new Date().toISOString()
      }
    }

    return {
      success: true,
      usage,
      lastUpdated: new Date().toISOString()
    }
  } catch (e: any) {
    const message = e.message || String(e)
    if (message.includes('fetch failed')) {
      return {
        success: false,
        usage: [],
        error: ERROR_MESSAGES.API.NETWORK_ERROR(message),
        lastUpdated: new Date().toISOString()
      }
    }
    return {
      success: false,
      usage: [],
      error: ERROR_MESSAGES.API.UNKNOWN(message),
      lastUpdated: new Date().toISOString()
    }
  }
}
