export type GqlRaw = { __gqlRaw: string }

/** Embed a raw GraphQL literal (use sparingly). */
export function gqlRaw(raw: string): GqlRaw {
  return { __gqlRaw: raw }
}

/** Embed a GraphQL enum value (unquoted). */
export function gqlEnum(value: string): GqlRaw {
  return gqlRaw(value)
}

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
    const obj = value as any
    if (obj && typeof obj.__gqlRaw === 'string') return String(obj.__gqlRaw)
    const rec = obj as Record<string, unknown>
    const entries = Object.entries(rec)
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
