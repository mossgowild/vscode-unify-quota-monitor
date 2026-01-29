import { promises as fs } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CLAUDE_DIR = join(homedir(), '.claude')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
const DEFAULT_5_HOUR_LIMIT_USD = 5.0

const PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-opus-4-5-20251101': { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  default: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
}

/* eslint-disable @typescript-eslint/naming-convention */
interface ClaudeUsageEntry {
  timestamp: string
  message?: {
    model?: string
    usage?: {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
  type?: string
}

interface FiveHourBlock {
  startTime: Date
  endTime: Date
  costUSD: number
}

export interface ClaudeCodeUsageResult {
  isInstalled: boolean
  hasUsageData: boolean
  costUSD: number
  remainingPercent: number
  resetTime: Date | null
  error?: string
}

function calculateCost(entry: ClaudeUsageEntry): number {
  const usage = entry.message?.usage
  if (!usage) return 0

  const model = entry.message?.model || 'default'
  const pricing = PRICING[model] || PRICING.default

  const inputCost = (usage.input_tokens || 0) * pricing.input / 1_000_000
  const outputCost = (usage.output_tokens || 0) * pricing.output / 1_000_000
  const cacheWriteCost = (usage.cache_creation_input_tokens || 0) * pricing.cacheWrite / 1_000_000
  const cacheReadCost = (usage.cache_read_input_tokens || 0) * pricing.cacheRead / 1_000_000

  return inputCost + outputCost + cacheWriteCost + cacheReadCost
}

export async function checkClaudeCodeInstalled(): Promise<boolean> {
  try {
    const credPath = join(CLAUDE_DIR, '.credentials.json')
    await stat(credPath)
    return true
  } catch {
    return false
  }
}

async function findAllJsonlFiles(): Promise<string[]> {
  const jsonlFiles: string[] = []

  try {
    const projectsStat = await stat(PROJECTS_DIR)
    if (!projectsStat.isDirectory()) return jsonlFiles

    const projectDirs = await readdir(PROJECTS_DIR)
    for (const projectDir of projectDirs) {
      const projectPath = join(PROJECTS_DIR, projectDir)
      try {
        const dirStat = await stat(projectPath)
        if (!dirStat.isDirectory()) continue

        const files = await readdir(projectPath)
        for (const file of files) {
          if (file.endsWith('.jsonl')) {
            jsonlFiles.push(join(projectPath, file))
          }
        }
      } catch {
        continue
      }
    }
  } catch {
    return jsonlFiles
  }

  return jsonlFiles
}

async function loadRecentEntries(): Promise<ClaudeUsageEntry[]> {
  const entries: ClaudeUsageEntry[] = []
  const fiveHoursAgo = Date.now() - FIVE_HOURS_MS
  const jsonlFiles = await findAllJsonlFiles()

  for (const filePath of jsonlFiles) {
    try {
      const fileStat = await stat(filePath)
      if (fileStat.mtimeMs < fiveHoursAgo) continue

      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const entry = JSON.parse(trimmed) as ClaudeUsageEntry
          if (entry.type !== 'assistant' || !entry.message?.usage) continue

          const entryTime = new Date(entry.timestamp).getTime()
          if (entryTime >= fiveHoursAgo) {
            entries.push(entry)
          }
        } catch {
          continue
        }
      }
    } catch {
      continue
    }
  }

  return entries
}

function calculateActiveBlockCost(entries: ClaudeUsageEntry[]): FiveHourBlock | null {
  if (entries.length === 0) return null

  const now = Date.now()
  const fiveHoursAgo = now - FIVE_HOURS_MS

  let totalCost = 0
  for (const entry of entries) {
    const entryTime = new Date(entry.timestamp).getTime()
    if (entryTime >= fiveHoursAgo) {
      totalCost += calculateCost(entry)
    }
  }

  return {
    startTime: new Date(fiveHoursAgo),
    endTime: new Date(now + FIVE_HOURS_MS - (now - fiveHoursAgo)),
    costUSD: totalCost,
  }
}

export async function getClaudeCodeUsage(): Promise<ClaudeCodeUsageResult> {
  // Step 1: Check if installed
  const isInstalled = await checkClaudeCodeInstalled()
  if (!isInstalled) {
    return {
      isInstalled: false,
      hasUsageData: false,
      costUSD: 0,
      remainingPercent: 0,
      resetTime: null,
      error: 'Claude Code not installed. Run `npm install -g @anthropic-ai/claude-code`',
    }
  }

  // Step 2: Load usage data
  const entries = await loadRecentEntries()
  if (entries.length === 0) {
    return {
      isInstalled: true,
      hasUsageData: false,
      costUSD: 0,
      remainingPercent: 100,
      resetTime: new Date(Date.now() + FIVE_HOURS_MS),
      error: 'No usage data yet. Start using Claude Code to see quota.',
    }
  }

  // Step 3: Calculate usage
  const activeBlock = calculateActiveBlockCost(entries)
  const costUSD = activeBlock?.costUSD || 0
  const remainingPercent = Math.max(0, Math.round(100 - (costUSD / DEFAULT_5_HOUR_LIMIT_USD) * 100))

  return {
    isInstalled: true,
    hasUsageData: true,
    costUSD,
    remainingPercent,
    resetTime: activeBlock?.endTime || null,
  }
}
