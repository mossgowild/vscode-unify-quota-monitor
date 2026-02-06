function isNumericToken(token: string): boolean {
  return /^\d+(\.\d+)?$/.test(token)
}

function formatToken(token: string): string {
  if (!token) return token
  if (isNumericToken(token)) {
    if (token.endsWith('.0')) {
      return token.slice(0, -2)
    }
    return token
  }
  return token.charAt(0).toUpperCase() + token.slice(1)
}

export function formatModelName(rawId: string): string {
  if (!rawId) return rawId

  let id = rawId.trim()
  if (!id) return rawId

  let isVertex = false
  if (id.endsWith('_vertex')) {
    isVertex = true
    id = id.slice(0, -'_vertex'.length)
  }

  id = id.replace(/_/g, '.')

  const rawTokens = id.split('-').filter(Boolean)
  const tokens: string[] = []

  for (let i = 0; i < rawTokens.length; i += 1) {
    const token = rawTokens[i]
    const next = rawTokens[i + 1]
    if (next && isNumericToken(token) && isNumericToken(next) && !token.includes('.') && next.length === 1) {
      tokens.push(`${token}.${next}`)
      i += 1
      continue
    }
    tokens.push(token)
  }

  let result = tokens.map((token) => formatToken(token)).join(' ')
  if (isVertex) {
    result = `${result} (Vertex)`
  }

  return result
}
