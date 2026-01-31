export function uid(): string {
  // Prefer crypto UUID when available
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function formatNumber(n: number, maxFrac = 2): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const frac = abs >= 100 ? 0 : abs >= 10 ? Math.min(1, maxFrac) : maxFrac
  return n.toLocaleString(undefined, { maximumFractionDigits: frac })
}
