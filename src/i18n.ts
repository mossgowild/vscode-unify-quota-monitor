import { env, l10n } from 'vscode'

export function isZhCn(): boolean {
  return env.language === 'zh-cn'
}

export function t(message: string, args?: Record<string, string | number>): string {
  return l10n.t(message, args as Record<string, string>)
}
