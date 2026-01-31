export function toGqlLiteral(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'null'
  if (typeof value === 'string') return JSON.stringify(value) // valid GraphQL string literal
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'

  if (Array.isArray(value)) {
    return `[${value.map(v => toGqlLiteral(v)).join(',')}]`
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const entries = Object.entries(obj)
      .filter(([, v]) => v !== undefined) // omit undefined
      .map(([k, v]) => `${k}:${toGqlLiteral(v)}`)
    return `{${entries.join(',')}}`
  }

  return 'null'
}

export function gqlArgs(args: Record<string, unknown>): string {
  const parts = Object.entries(args)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${toGqlLiteral(v)}`)
  return parts.join(', ')
}
