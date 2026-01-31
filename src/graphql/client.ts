export type GraphQLErrorItem = {
  message: string
  path?: Array<string | number>
  extensions?: unknown
}

export class GraphQLRequestError extends Error {
  public readonly errors: GraphQLErrorItem[]
  public readonly response: unknown

  constructor(message: string, errors: GraphQLErrorItem[], response: unknown) {
    super(message)
    this.name = 'GraphQLRequestError'
    this.errors = errors
    this.response = response
  }
}

export const GRAPHQL_URL: string =
  (import.meta as any).env?.VITE_GRAPHQL_URL ?? 'http://localhost:4000/graphql'

export function isSelectionSetError(err: unknown): boolean {
  if (!(err instanceof GraphQLRequestError)) return false
  return err.errors.some(e =>
    typeof e.message === 'string' && e.message.toLowerCase().includes('must have a selection of subfields'),
  )
}

function toErrorMessage(payload: any): string {
  if (!payload) return 'Unknown GraphQL error'
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    return payload.errors.map((e: any) => e?.message ?? String(e)).join('\n')
  }
  return String(payload)
}

export async function gqlRequest<TData = any>(
  query: string,
  variables?: Record<string, unknown>,
  opts?: { signal?: AbortSignal },
): Promise<TData> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: opts?.signal,
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    const msg = `GraphQL HTTP ${res.status}: ${toErrorMessage(json) || res.statusText}`
    throw new Error(msg)
  }

  if (json?.errors?.length) {
    throw new GraphQLRequestError(
      json.errors.map((e: any) => e?.message ?? String(e)).join('\n'),
      json.errors as GraphQLErrorItem[],
      json,
    )
  }

  return (json?.data ?? null) as TData
}
