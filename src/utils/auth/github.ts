/* eslint-disable @typescript-eslint/naming-convention */
import { authentication } from 'vscode'
import { ERROR_MESSAGES } from '../../constants'

export async function loginWithGitHub(): Promise<string> {
  await authentication.getSession('github', ['read:user'], { createIfNone: true })
  return 'vscode-github-session'
}

export async function getGitHubAccessToken(): Promise<string | null> {
  try {
    const session = await authentication.getSession('github', ['read:user'], { createIfNone: false })
    return session?.accessToken || null
  } catch {
    return null
  }
}

export async function exchangeGitHubTokenForCopilot(githubToken: string): Promise<string> {
  const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      'Authorization': `token ${githubToken}`,
      'User-Agent': 'GitHubCopilotChat/0.24.0',
      'Editor-Version': 'vscode/1.97.0',
      'Editor-Plugin-Version': 'copilot-chat/0.24.0',
      'Copilot-Integration-Id': 'vscode-chat'
    }
  })

  if (!response.ok) {
    throw new Error(ERROR_MESSAGES.AUTH.TOKEN_EXCHANGE_FAILED(response.statusText))
  }

  const data = await response.json() as any
  return data.token
}
