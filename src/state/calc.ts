import type { FoodDetailsLite, NutrientAmount, Recipe, WeekPlan } from './types'

export type NutrientTotals = Record<string, NutrientAmount>

export function scaleFood(food: FoodDetailsLite, grams: number): NutrientTotals {
  const factor = grams / 100
  const out: NutrientTotals = {}
  for (const n of food.foodNutrients) {
    if (!Number.isFinite(n.amount)) continue
    const key = String(n.nutrientId)
    out[key] = {
      nutrientId: n.nutrientId,
      name: n.name,
      unitName: n.unitName,
      amount: (out[key]?.amount ?? 0) + n.amount * factor,
    }
  }
  return out
}

export function addTotals(a: NutrientTotals, b: NutrientTotals): NutrientTotals {
  const out: NutrientTotals = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const existing = out[k]
    out[k] = existing
      ? { ...existing, amount: existing.amount + v.amount }
      : { ...v }
  }
  return out
}

export function recipeTotals(recipe: Recipe, foodCache: Record<string, FoodDetailsLite>): NutrientTotals {
  let totals: NutrientTotals = {}
  for (const ing of recipe.ingredients) {
    const food = foodCache[String(ing.fdcId)]
    if (!food) continue
    totals = addTotals(totals, scaleFood(food, ing.grams))
  }
  return totals
}

export function dayTotals(
  dayIndex: number,
  plan: WeekPlan,
  recipesById: Record<string, Recipe>,
  foodCache: Record<string, FoodDetailsLite>,
): NutrientTotals {
  const day = plan.days[dayIndex]
  if (!day) return {}
  const ids = [
    day.breakfastRecipeId,
    day.lunchRecipeId,
    day.dinnerRecipeId,
    ...day.snackRecipeIds,
  ].filter(Boolean) as string[]

  let totals: NutrientTotals = {}
  for (const id of ids) {
    const r = recipesById[id]
    if (!r) continue
    totals = addTotals(totals, recipeTotals(r, foodCache))
  }
  return totals
}

export function weekTotals(
  plan: WeekPlan,
  recipesById: Record<string, Recipe>,
  foodCache: Record<string, FoodDetailsLite>,
): NutrientTotals {
  let totals: NutrientTotals = {}
  for (let i = 0; i < plan.days.length; i++) {
    totals = addTotals(totals, dayTotals(i, plan, recipesById, foodCache))
  }
  return totals
}

export function pickMacroSnapshot(t: NutrientTotals): {
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
} {
  // Common FDC nutrient IDs:
  // 1008 Energy (kcal), 1003 Protein, 1005 Carbohydrate, 1004 Total lipid (fat), 1079 Fiber (dietary)
  const calories = t['1008']?.amount
  const protein = t['1003']?.amount
  const carbs = t['1005']?.amount
  const fat = t['1004']?.amount
  const fiber = t['1079']?.amount
  return { calories, protein, carbs, fat, fiber }
}
