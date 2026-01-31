import type { FoodDetailsLite, NutrientAmount } from '../state/types'

type AnyJson = any

export function normalizeFoodDetails(food: AnyJson): FoodDetailsLite {
  const now = new Date().toISOString()
  const fdcId = Number(food?.fdcId)
  const description = String(food?.description ?? `FDC ${fdcId}`)
  const dataType = food?.dataType ? String(food.dataType) : undefined
  const brandOwner = food?.brandOwner ? String(food.brandOwner) : undefined
  const servingSize = typeof food?.servingSize === 'number' ? food.servingSize : undefined
  const servingSizeUnit = food?.servingSizeUnit ? String(food.servingSizeUnit) : undefined

  const foodNutrientsRaw = Array.isArray(food?.foodNutrients) ? food.foodNutrients : []
  const nutrients: NutrientAmount[] = foodNutrientsRaw
    .map((n: AnyJson) => {
      const nutrient = n?.nutrient ?? n
      const nutrientId = Number(nutrient?.id ?? n?.nutrientId)
      const name = String(nutrient?.name ?? n?.name ?? '')
      const unitName = String(nutrient?.unitName ?? n?.unitName ?? '')
      const amount = Number(n?.amount ?? n?.value ?? NaN)
      if (!Number.isFinite(nutrientId) || !name || !Number.isFinite(amount)) return undefined
      return { nutrientId, name, unitName, amount }
    })
    .filter(Boolean) as NutrientAmount[]

  // De-dupe by nutrientId (sum amounts)
  const byId = new Map<number, NutrientAmount>()
  for (const n of nutrients) {
    const existing = byId.get(n.nutrientId)
    byId.set(n.nutrientId, existing ? { ...existing, amount: existing.amount + n.amount } : n)
  }

  return {
    fdcId,
    description,
    dataType,
    brandOwner,
    servingSize,
    servingSizeUnit,
    foodNutrients: Array.from(byId.values()).sort((a, b) => a.nutrientId - b.nutrientId),
    lastFetchedISO: now,
  }
}
