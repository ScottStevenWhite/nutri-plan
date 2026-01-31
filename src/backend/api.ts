import type { FoodDetailsLite, PersonProfile, Recipe, WeekPlan } from '../state/types'
import { gqlRequest, isSelectionSetError } from '../graphql/client'
import { gqlArgs, toGqlLiteral } from '../graphql/literal'

const APP_STATE_SELECTION = `
  version
  selectedPersonId
  people {
    id
    name
    sex
    dateOfBirthISO
    heightIn
    currentWeightLb
    targetWeightLb
    activityLevel
    pregnancy { enabled trimester dueDateISO breastfeeding }
    notes
    nutrientTargets { nutrientId name unitName daily weeklyOverride }
  }
  recipes {
    id
    name
    tags
    notes
    ingredients { id fdcId description grams }
  }
  plan {
    id
    name
    startDateISO
    days {
      breakfastRecipeId
      lunchRecipeId
      dinnerRecipeId
      snackRecipeIds
    }
  }
  foodCache {
    fdcId
    description
    dataType
    brandOwner
    servingSize
    servingSizeUnit
    lastFetchedISO
    foodNutrients { nutrientId name unitName amount }
  }
`.trim()

async function queryFieldMaybeScalar<T = any>(fieldCall: string, selection?: string): Promise<T> {
  // Attempt scalar / JSON return first: query { fieldCall }
  try {
    const q = `query { ${fieldCall} }`
    const data = await gqlRequest<Record<string, any>>(q)
    const fieldName = fieldCall.split('(')[0].trim()
    return data[fieldName] as T
  } catch (e) {
    if (!selection || !isSelectionSetError(e)) throw e
    const q = `query { ${fieldCall} { ${selection} } }`
    const data = await gqlRequest<Record<string, any>>(q)
    const fieldName = fieldCall.split('(')[0].trim()
    return data[fieldName] as T
  }
}

async function mutateMaybeScalar(fieldCall: string): Promise<void> {
  // Attempt scalar return first: mutation { fieldCall }
  try {
    await gqlRequest(`mutation { ${fieldCall} }`)
  } catch (e) {
    if (!isSelectionSetError(e)) throw e
    // If it returns an object, select __typename and move on.
    await gqlRequest(`mutation { ${fieldCall} { __typename } }`)
  }
}

function personToBackendInput(p: PersonProfile): any {
  // Avoid GraphQL object keys like "1008" (invalid field names) by sending nutrientTargets as a list.
  return {
    ...p,
    nutrientTargets: Object.values(p.nutrientTargets ?? {}),
  }
}

export async function fetchAppState(): Promise<any> {
  // prefer scalar JSON if backend exposes it; fallback to typed selection set
  return queryFieldMaybeScalar('appState', APP_STATE_SELECTION)
}

export async function backendSetApiKey(apiKey: string): Promise<void> {
  const args = gqlArgs({ apiKey })
  await mutateMaybeScalar(`setApiKey(${args})`)
}

export async function backendUpsertPerson(person: PersonProfile): Promise<void> {
  await mutateMaybeScalar(`upsertPerson(person: ${toGqlLiteral(personToBackendInput(person))})`)
}

export async function backendDeletePerson(personId: string): Promise<void> {
  await mutateMaybeScalar(`deletePerson(personId: ${toGqlLiteral(personId)})`)
}

export async function backendUpsertRecipe(recipe: Recipe): Promise<void> {
  await mutateMaybeScalar(`upsertRecipe(recipe: ${toGqlLiteral(recipe)})`)
}

export async function backendDeleteRecipe(recipeId: string): Promise<void> {
  await mutateMaybeScalar(`deleteRecipe(recipeId: ${toGqlLiteral(recipeId)})`)
}

export async function backendSetPlan(plan: WeekPlan): Promise<void> {
  await mutateMaybeScalar(`setPlan(plan: ${toGqlLiteral(plan)})`)
}

export async function backendCacheFood(food: FoodDetailsLite): Promise<void> {
  await mutateMaybeScalar(`cacheFood(food: ${toGqlLiteral(food)})`)
}

export async function backendResetAll(): Promise<void> {
  await mutateMaybeScalar('resetAll')
}
