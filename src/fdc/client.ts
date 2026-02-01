import type { FoodDetailsLite } from '../state/types'
import { gqlRequest } from '../graphql/client'
import { gqlArgs, toGqlLiteral } from '../graphql/literal'

export type FoodSearchItem = {
  fdcId: number
  description: string
  dataType?: string
  brandOwner?: string
  publicationDate?: string
}

export type FoodSearchResponse = {
  foods: FoodSearchItem[]
}

const SEARCH_ITEM_SELECTION = `
  fdcId
  description
  dataType
  brandOwner
  publicationDate
`.trim()

const DETAILS_SELECTION = `
  fdcId
  description
  dataType
  brandOwner
  servingSize
  servingSizeUnit
  lastFetchedISO
  foodNutrients { nutrientId name unitName amount }
`.trim()

export async function searchFoods(
  query: string,
  opts?: { pageSize?: number; pageNumber?: number; includeBranded?: boolean },
): Promise<FoodSearchResponse> {
  const args = gqlArgs({
    query,
    includeBranded: opts?.includeBranded ?? false,
    pageSize: opts?.pageSize ?? 25,
    pageNumber: opts?.pageNumber ?? 1,
  })

  const q = `query { fdcSearchFoods(${args}) { ${SEARCH_ITEM_SELECTION} } }`
  const data = await gqlRequest<{ fdcSearchFoods: any[] }>(q)
  return { foods: Array.isArray(data.fdcSearchFoods) ? (data.fdcSearchFoods as FoodSearchItem[]) : [] }
}

export async function getFoodDetails(fdcId: number): Promise<FoodDetailsLite> {
  const q = `query { fdcGetFoodDetails(fdcId: ${toGqlLiteral(fdcId)}) { ${DETAILS_SELECTION} } }`
  const data = await gqlRequest<{ fdcGetFoodDetails: any }>(q)
  return data.fdcGetFoodDetails as FoodDetailsLite
}
