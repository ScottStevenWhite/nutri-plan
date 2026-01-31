import type { FoodDetailsLite } from '../state/types'
import { gqlRequest, isSelectionSetError } from '../graphql/client'
import { gqlArgs, toGqlLiteral } from '../graphql/literal'

export type FdcDataType = 'Branded' | 'Foundation' | 'Survey (FNDDS)' | 'SR Legacy'

export type FoodSearchItem = {
  fdcId: number
  description: string
  dataType?: string
  brandOwner?: string
  publicationDate?: string
}

export type FoodSearchResponse = {
  totalHits?: number
  currentPage?: number
  totalPages?: number
  foods: FoodSearchItem[]
}

const SEARCH_SELECTION = `
  totalHits
  currentPage
  totalPages
  foods { fdcId description dataType brandOwner publicationDate }
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

function normalizeSearchResponse(x: any): FoodSearchResponse {
  if (!x || typeof x !== 'object') return { foods: [] }
  return {
    totalHits: typeof x.totalHits === 'number' ? x.totalHits : undefined,
    currentPage: typeof x.currentPage === 'number' ? x.currentPage : undefined,
    totalPages: typeof x.totalPages === 'number' ? x.totalPages : undefined,
    foods: Array.isArray(x.foods) ? (x.foods as FoodSearchItem[]) : [],
  }
}

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

  const call = `fdcSearchFoods(${args})`

  try {
    const data = await gqlRequest<{ fdcSearchFoods: any }>(`query { ${call} }`)
    return normalizeSearchResponse(data.fdcSearchFoods)
  } catch (e) {
    if (!isSelectionSetError(e)) throw e
    const data = await gqlRequest<{ fdcSearchFoods: any }>(`query { ${call} { ${SEARCH_SELECTION} } }`)
    return normalizeSearchResponse(data.fdcSearchFoods)
  }
}

export async function getFoodDetails(fdcId: number): Promise<FoodDetailsLite> {
  const call = `fdcGetFoodDetails(fdcId: ${toGqlLiteral(fdcId)})`

  try {
    const data = await gqlRequest<{ fdcGetFoodDetails: any }>(`query { ${call} }`)
    return data.fdcGetFoodDetails as FoodDetailsLite
  } catch (e) {
    if (!isSelectionSetError(e)) throw e
    const data = await gqlRequest<{ fdcGetFoodDetails: any }>(`query { ${call} { ${DETAILS_SELECTION} } }`)
    return data.fdcGetFoodDetails as FoodDetailsLite
  }
}
