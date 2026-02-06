import type { FetchUsageResult, UsageCategory } from '../../types'
import { refreshGeminiCliToken } from '../auth/gemini'
import { ERROR_MESSAGES } from '../../constants'
import { formatModelName } from './format-model-name'

interface GeminiCredential {
  accessToken?: string
  refreshToken?: string
}

interface LoadCodeAssistResponse {
  cloudaicompanionProject?: string
}

interface QuotaBucket {
  modelId: string
  remainingFraction: number
  resetTime?: string
}

interface QuotaResponse {
  buckets?: QuotaBucket[]
}

export async function fetchGeminiCliUsage(
  credentialString: string,
  onCredentialUpdated?: (newCredential: string) => Promise<void>
): Promise<FetchUsageResult> {
  let credentialData: GeminiCredential
  try {
    credentialData = JSON.parse(credentialString) as GeminiCredential
  } catch {
    return {
      success: false,
      usage: [],
      error: ERROR_MESSAGES.AUTH.INVALID_FORMAT,
      lastUpdated: new Date().toISOString()
    }
  }

  let accessToken = credentialData.accessToken || ''
  let currentCredentialString = credentialString

  // Try to refresh token if no access token
  if (!accessToken && credentialData.refreshToken) {
    const result = await refreshGeminiCliToken(credentialString)
    if (result) {
      accessToken = result.accessToken
      currentCredentialString = result.newCredential
      credentialData = JSON.parse(result.newCredential) as GeminiCredential
      if (onCredentialUpdated) {
        await onCredentialUpdated(result.newCredential)
      }
    }
  }

  if (!accessToken) {
    return {
      success: false,
      usage: [],
      error: ERROR_MESSAGES.AUTH.NO_ACCESS_TOKEN,
      lastUpdated: new Date().toISOString()
    }
  }

  // Helper to make API calls with retry on 401
  async function makeRequest<T>(url: string, body: object): Promise<T | null> {
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'gemini-cli/1.0'
      },
      body: JSON.stringify(body)
    })

    // Retry once with refreshed token on 401
    if (response.status === 401 && credentialData.refreshToken) {
      const result = await refreshGeminiCliToken(currentCredentialString)
      if (result) {
        accessToken = result.accessToken
        currentCredentialString = result.newCredential
        credentialData = JSON.parse(result.newCredential) as GeminiCredential
        if (onCredentialUpdated) {
          await onCredentialUpdated(result.newCredential)
        }

        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'gemini-cli/1.0'
          },
          body: JSON.stringify(body)
        })
      }
    }

    if (!response.ok) {
      return null
    }

    return response.json() as Promise<T>
  }

  // Step 1: Get project ID
  const loadCodeAssistUrl = 'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist'
  const loadCodeAssistBody = {
    metadata: {
      ideType: 'IDE_UNSPECIFIED',
      platform: 'PLATFORM_UNSPECIFIED',
      pluginType: 'GEMINI'
    }
  }

  const loadResult = await makeRequest<LoadCodeAssistResponse>(loadCodeAssistUrl, loadCodeAssistBody)
  if (!loadResult?.cloudaicompanionProject) {
    return {
      success: false,
      usage: [],
      error: ERROR_MESSAGES.GEMINI.PROJECT_LOAD_FAILED,
      lastUpdated: new Date().toISOString()
    }
  }

  const projectId = loadResult.cloudaicompanionProject

  // Step 2: Get quota
  const quotaUrl = 'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota'
  const quotaBody = { project: projectId }

  const quotaResult = await makeRequest<QuotaResponse>(quotaUrl, quotaBody)
  if (!quotaResult?.buckets) {
    return {
      success: false,
      usage: [],
      error: ERROR_MESSAGES.GEMINI.QUOTA_FETCH_FAILED,
      lastUpdated: new Date().toISOString()
    }
  }

  // Map buckets to usage categories
  const usage: UsageCategory[] = []
  for (const bucket of quotaResult.buckets) {
    const label = formatModelName(bucket.modelId)
    usage.push({
      name: label,
      limitType: 'request',
      used: Math.round((1 - bucket.remainingFraction) * 100),
      total: 100,
      percentageOnly: true,
      resetTime: bucket.resetTime
    })
  }

  // Sort by usage percentage (ascending - more remaining first)
  usage.sort((a, b) => {
    const pA = a.total > 0 ? (a.used / a.total) : 0
    const pB = b.total > 0 ? (b.used / b.total) : 0
    return pA - pB
  })

  return {
    success: true,
    usage,
    lastUpdated: new Date().toISOString()
  }
}
