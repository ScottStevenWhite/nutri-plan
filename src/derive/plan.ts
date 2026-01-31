import type { Recipe, WeekPlan } from '../state/types'

export type RecipeUseCounts = Record<string, number>

export function recipeUseCounts(plan: WeekPlan): RecipeUseCounts {
  const counts: RecipeUseCounts = {}
  for (const day of plan.days) {
    const ids = [
      day.breakfastRecipeId,
      day.lunchRecipeId,
      day.dinnerRecipeId,
      ...(day.snackRecipeIds ?? []),
    ].filter(Boolean) as string[]

    for (const id of ids) {
      counts[id] = (counts[id] ?? 0) + 1
    }
  }
  return counts
}

export type IngredientDemand = {
  fdcId: number
  description: string
  totalGrams: number
  recipeIds: string[]
}

export function computeIngredientDemand(plan: WeekPlan, recipesById: Record<string, Recipe>): Record<string, IngredientDemand> {
  const uses = recipeUseCounts(plan)
  const out: Record<string, IngredientDemand> = {}

  for (const [recipeId, count] of Object.entries(uses)) {
    const recipe = recipesById[recipeId]
    if (!recipe) continue

    for (const ing of recipe.ingredients) {
      const key = String(ing.fdcId)
      const existing = out[key]
      const grams = ing.grams * count

      if (!existing) {
        out[key] = {
          fdcId: ing.fdcId,
          description: ing.description,
          totalGrams: grams,
          recipeIds: [recipeId],
        }
      } else {
        existing.totalGrams += grams
        if (!existing.recipeIds.includes(recipeId)) existing.recipeIds.push(recipeId)
      }
    }
  }

  return out
}

export function planCompleteness(plan: WeekPlan): {
  days: number
  totalMealSlots: number
  filledMealSlots: number
  missingMealSlots: number
  missingByDay: Array<{ dayIndex: number; missing: Array<'breakfast' | 'lunch' | 'dinner'> }>
} {
  const days = plan.days.length
  const totalMealSlots = days * 3

  let filled = 0
  const missingByDay: Array<{ dayIndex: number; missing: Array<'breakfast' | 'lunch' | 'dinner'> }> = []

  plan.days.forEach((d, i) => {
    const missing: Array<'breakfast' | 'lunch' | 'dinner'> = []
    if (d.breakfastRecipeId) filled++
    else missing.push('breakfast')
    if (d.lunchRecipeId) filled++
    else missing.push('lunch')
    if (d.dinnerRecipeId) filled++
    else missing.push('dinner')

    if (missing.length) missingByDay.push({ dayIndex: i, missing })
  })

  return {
    days,
    totalMealSlots,
    filledMealSlots: filled,
    missingMealSlots: totalMealSlots - filled,
    missingByDay,
  }
}
