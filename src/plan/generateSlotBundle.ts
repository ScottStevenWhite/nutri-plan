import type { DayPlan, Recipe, RecipeTag, WeekPlan } from '../state/types'
import { todayISO, uid } from '../state/utils'

export type SlotBundleRequest = {
  breakfasts: number
  lunches: number
  dinners: number
  includeSnacks: boolean
}

/**
 * A is the estimated number of days covered by the bundle.
 * v0 heuristic: round average count across meal types, clamped to [0..7]
 * Example: 3,2,3 => (8/3)=2.67 => 3 snack days.
 */
export function snackDaysFromCounts(b: number, l: number, d: number): number {
  const raw = (b + l + d) / 3
  const rounded = Math.round(raw)
  return clampInt(rounded, 0, 7)
}

export function generateSlotBundle(
  recipes: Recipe[],
  req: SlotBundleRequest,
  opts?: { name?: string; allowRepeats?: boolean; preferTags?: boolean },
): WeekPlan {
  const breakfasts = clampInt(req.breakfasts, 0, 7)
  const lunches = clampInt(req.lunches, 0, 7)
  const dinners = clampInt(req.dinners, 0, 7)

  const includeSnacks = Boolean(req.includeSnacks)
  const snackDays = includeSnacks ? snackDaysFromCounts(breakfasts, lunches, dinners) : 0

  const allowRepeats = opts?.allowRepeats ?? true
  const preferTags = opts?.preferTags ?? true

  const breakfastIds = pickRecipeIds(recipes, 'breakfast', breakfasts, { allowRepeats, preferTags })
  const lunchIds = pickRecipeIds(recipes, 'lunch', lunches, { allowRepeats, preferTags })
  const dinnerIds = pickRecipeIds(recipes, 'dinner', dinners, { allowRepeats, preferTags })
  const snackIds = pickRecipeIds(recipes, 'snack', snackDays, { allowRepeats, preferTags })

  const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => ({
    breakfastRecipeId: breakfastIds[i],
    lunchRecipeId: lunchIds[i],
    dinnerRecipeId: dinnerIds[i],
    snackRecipeIds: snackIds[i] ? [snackIds[i]] : [],
  }))

  return {
    id: uid(),
    name: opts?.name?.trim() || 'Slot Bundle',
    startDateISO: todayISO(),
    days,
  }
}

export function countBundleAssignments(plan: WeekPlan): {
  breakfasts: number
  lunches: number
  dinners: number
  snackDays: number
} {
  let breakfasts = 0
  let lunches = 0
  let dinners = 0
  let snackDays = 0

  for (const d of plan.days) {
    if (d.breakfastRecipeId) breakfasts++
    if (d.lunchRecipeId) lunches++
    if (d.dinnerRecipeId) dinners++
    if ((d.snackRecipeIds ?? []).filter(Boolean).length > 0) snackDays++
  }

  return { breakfasts, lunches, dinners, snackDays }
}

function pickRecipeIds(
  recipes: Recipe[],
  tag: RecipeTag,
  count: number,
  opts: { allowRepeats: boolean; preferTags: boolean },
): Array<string | undefined> {
  if (count <= 0) return Array.from({ length: 7 }, () => undefined)

  const poolTagged = recipes.filter(r => (r.tags ?? []).includes(tag))
  const pool = opts.preferTags && poolTagged.length ? poolTagged : recipes

  if (!pool.length) return Array.from({ length: 7 }, () => undefined)

  const wanted = clampInt(count, 0, 7)

  // Sample without replacement if possible; otherwise cycle (repeats).
  const ids: string[] = []
  const shuffled = shuffle(pool.slice())

  if (wanted <= shuffled.length) {
    for (let i = 0; i < wanted; i++) ids.push(shuffled[i].id)
  } else {
    // repeats needed
    if (!opts.allowRepeats) {
      for (let i = 0; i < shuffled.length; i++) ids.push(shuffled[i].id)
    } else {
      let i = 0
      while (ids.length < wanted) {
        ids.push(shuffled[i % shuffled.length].id)
        i++
      }
    }
  }

  // Expand to 7 slots (undefined for remaining days)
  return Array.from({ length: 7 }, (_, i) => ids[i])
}

function shuffle<T>(arr: T[]): T[] {
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

function clampInt(n: number, min: number, max: number): number {
  const x = Number.isFinite(n) ? Math.trunc(n) : min
  return Math.max(min, Math.min(max, x))
}
