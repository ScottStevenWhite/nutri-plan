import type { Recipe, WeekPlan } from '../state/types'
import { computeIngredientDemand, recipeUseCounts } from './plan'

export type PrepTask = {
  id: string
  title: string
  detail?: string
  usedBy?: string[]
}

/**
 * v0 heuristic: we can generate something useful today without recipe steps.
 * - Suggest "Batch cook" for recipes repeated 2+ times
 * - Suggest "Prep ingredient" for ingredients used across many recipes and/or large total grams
 */
export function computePrepTasks(plan: WeekPlan, recipesById: Record<string, Recipe>): PrepTask[] {
  const tasks: PrepTask[] = []

  // 1) Batch cook repeated recipes
  const uses = recipeUseCounts(plan)
  for (const [recipeId, count] of Object.entries(uses)) {
    if (count < 2) continue
    const r = recipesById[recipeId]
    if (!r) continue
    tasks.push({
      id: `recipe:${recipeId}`,
      title: `Batch cook: ${r.name}`,
      detail: `Used ${count}× this week`,
      usedBy: [r.name],
    })
  }

  // 2) Prep repeated ingredients
  const demand = computeIngredientDemand(plan, recipesById)
  for (const d of Object.values(demand)) {
    const usedByCount = d.recipeIds.length
    const grams = d.totalGrams

    // heuristic thresholds (tune later)
    const shouldPrep = usedByCount >= 3 || grams >= 600
    if (!shouldPrep) continue

    tasks.push({
      id: `ing:${d.fdcId}`,
      title: `Prep: ${d.description}`,
      detail: `${Math.round(grams)}g total · used in ${usedByCount} recipes`,
    })
  }

  // Sort: most impactful first
  tasks.sort((a, b) => (b.detail ?? '').localeCompare(a.detail ?? ''))
  return tasks
}
