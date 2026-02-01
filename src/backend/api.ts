import type {
  FoodDetailsLite,
  FdcStatus,
  GroceryLineStatus,
  GroceryList,
  PantryItem,
  PersonProfile,
  Recipe,
  ShoppingPreferences,
  SourcingRule,
  Supplement,
  Vendor,
  VendorProduct,
  WeekPlan,
} from '../state/types'
import { gqlRequest, isSelectionSetError } from '../graphql/client'
import { gqlArgs, gqlEnum, toGqlLiteral } from '../graphql/literal'

const APP_STATE_SELECTION = `
  version
  apiKey
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

    dietPattern
    dietNotes
    allergies

    supplements { id name category dose unit schedule notes }
    weightLog { dateISO weightLb }

    prePregnancy { enabled startDateISO notes }
    targetsGeneratedISO

    pregnancy { enabled trimester dueDateISO breastfeeding }
    notes

    nutrientTargets { nutrientId name unitName daily weeklyOverride }

    watchouts
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

  household {
    vendors {
      id
      name
      type
      notes
      availability { daysOfWeek seasonMonths orderCutoffDayOfWeek notes }
    }
    vendorProducts {
      id
      vendorId
      name
      packageSize { amount unit }
      gramsPerPackage
      tags
      notes
    }
    sourcingRules {
      id
      fdcId
      options { vendorProductId priority gramsPerPackage }
      notes
    }
    pantry {
      id
      name
      fdcId
      vendorProductId
      quantity { amount unit }
      grams
      notes
    }
    shoppingPreferences {
      vendorPriority
      preferredPrepDay
      maxStoreRunsPerWeek
      notes
    }
    equipment {
      schemaVersion
      generatedAtLocalDate
      defaults {
        unitSystem
        tempUnit
        kitchenLocation
        care { dishwasherSafe cleaningNeeds cleaningNotes }
      }
      items {
        id
        parentId
        name
        officialName
        manufacturer
        model
        serialNumber
        kitchenLocation
        category
        subtype
        categoryPath
        capabilities
        care { dishwasherSafe cleaningNeeds cleaningNotes }
        quantity
        quantityNote
        specs
        safety
        notes
      }
    }
  }
`.trim()

const GROCERY_LIST_SELECTION = `
  planId
  generatedISO
  warnings
  vendors {
    vendorId
    vendorName
    lines {
      key
      status
      name
      fdcId
      totalGrams
      haveGrams
      needGrams
      vendorId
      vendorName
      vendorProductId
      vendorProductName
      packagesToBuy
      gramsPerPackage
      usedBy
      notes
    }
  }
`.trim()

const FDC_STATUS_SELECTION = `
  hasApiKey
  source
`.trim()

const TARGET_GEN_SELECTION = `
  person {
    id name sex dateOfBirthISO heightIn currentWeightLb targetWeightLb activityLevel
    dietPattern dietNotes allergies
    supplements { id name category dose unit schedule notes }
    weightLog { dateISO weightLb }
    prePregnancy { enabled startDateISO notes }
    targetsGeneratedISO
    pregnancy { enabled trimester dueDateISO breastfeeding }
    notes
    nutrientTargets { nutrientId name unitName daily weeklyOverride }
    watchouts
  }
  generated { nutrientId name unitName daily weeklyOverride }
  watchouts
  notes
  debug
`.trim()

async function queryFieldMaybeScalar<T = any>(fieldCall: string, selection?: string): Promise<T> {
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
  try {
    await gqlRequest(`mutation { ${fieldCall} }`)
  } catch (e) {
    if (!isSelectionSetError(e)) throw e
    await gqlRequest(`mutation { ${fieldCall} { __typename } }`)
  }
}

function personToBackendInput(p: PersonProfile): any {
  // Strip computed fields that are NOT in PersonProfileInput
  const { watchouts, ...rest } = p as any

  // nutrientTargets must be a list for GraphQL input
  return {
    ...rest,
    nutrientTargets: Object.values(p.nutrientTargets ?? {}),
  }
}

export async function fetchAppState(): Promise<any> {
  return queryFieldMaybeScalar('appState', APP_STATE_SELECTION)
}

export async function fetchFdcStatus(): Promise<FdcStatus> {
  const data = await gqlRequest<{ fdcStatus: FdcStatus }>(`query { fdcStatus { ${FDC_STATUS_SELECTION} } }`)
  return data.fdcStatus
}

export async function fetchGroceryList(): Promise<GroceryList> {
  // IMPORTANT: omit planId to avoid mismatch while plan/recipes are still in optimistic sync.
  return queryFieldMaybeScalar<GroceryList>('groceryList', GROCERY_LIST_SELECTION)
}

// ------------------
// Existing mutations
// ------------------

export async function backendSetApiKey(apiKey: string): Promise<void> {
  const args = gqlArgs({ apiKey })
  await mutateMaybeScalar(`setApiKey(${args})`)
}

export async function backendSelectPerson(personId: string | undefined): Promise<void> {
  const call = personId ? `selectPerson(personId: ${toGqlLiteral(personId)})` : 'selectPerson'
  await mutateMaybeScalar(call)
}

export async function backendUpsertPerson(person: PersonProfile): Promise<void> {
  await mutateMaybeScalar(`upsertPerson(person: ${toGqlLiteral(personToBackendInput(person))})`)
}

export async function backendDeletePerson(personId: string): Promise<void> {
  await mutateMaybeScalar(`deletePerson(personId: ${toGqlLiteral(personId)})`)
}

export async function backendGenerateTargets(opts: {
  personId: string
  overwrite?: boolean
  includeMicronutrients?: boolean
}): Promise<any> {
  const args = gqlArgs({
    personId: opts.personId,
    overwrite: opts.overwrite ?? true,
    includeMicronutrients: opts.includeMicronutrients ?? false,
  })
  const q = `mutation { generateTargets(${args}) { ${TARGET_GEN_SELECTION} } }`
  const data = await gqlRequest<{ generateTargets: any }>(q)
  return data.generateTargets
}

export async function backendUpsertSupplement(personId: string, supplement: Supplement): Promise<void> {
  const args = gqlArgs({
    personId,
    supplement: supplement,
  })
  await mutateMaybeScalar(`upsertSupplement(${args})`)
}

export async function backendDeleteSupplement(personId: string, supplementId: string): Promise<void> {
  const args = gqlArgs({ personId, supplementId })
  await mutateMaybeScalar(`deleteSupplement(${args})`)
}

const RECIPE_SELECTION = `
  id
  name
  tags
  notes
  ingredients { id fdcId description grams }
`.trim()

export async function backendUpsertRecipe(recipe: Recipe): Promise<Recipe> {
  const q = `mutation { upsertRecipe(recipe: ${toGqlLiteral(recipe)}) { ${RECIPE_SELECTION} } }`
  const data = await gqlRequest<{ upsertRecipe: Recipe }>(q)
  return data.upsertRecipe
}


export async function backendDeleteRecipe(recipeId: string): Promise<void> {
  await mutateMaybeScalar(`deleteRecipe(recipeId: ${toGqlLiteral(recipeId)})`)
}

const PLAN_SELECTION = `
  id
  name
  startDateISO
  days { breakfastRecipeId lunchRecipeId dinnerRecipeId snackRecipeIds }
`.trim()

export async function backendSetPlan(plan: WeekPlan): Promise<WeekPlan> {
  const q = `mutation { setPlan(plan: ${toGqlLiteral(plan)}) { ${PLAN_SELECTION} } }`
  const data = await gqlRequest<{ setPlan: WeekPlan }>(q)
  return data.setPlan
}


export async function backendCacheFood(food: FoodDetailsLite): Promise<void> {
  await mutateMaybeScalar(`cacheFood(food: ${toGqlLiteral(food)})`)
}

export async function backendResetAll(): Promise<void> {
  await mutateMaybeScalar('resetAll')
}

// -----------------------
// Household CRUD (Phase 1)
// -----------------------

export async function backendSetShoppingPreferences(prefs: ShoppingPreferences): Promise<void> {
  await mutateMaybeScalar(`setShoppingPreferences(prefs: ${toGqlLiteral(prefs)})`)
}

export async function backendUpsertVendor(vendor: Vendor): Promise<void> {
  await mutateMaybeScalar(`upsertVendor(vendor: ${toGqlLiteral(vendor)})`)
}

export async function backendDeleteVendor(vendorId: string): Promise<void> {
  await mutateMaybeScalar(`deleteVendor(vendorId: ${toGqlLiteral(vendorId)})`)
}

export async function backendUpsertVendorProduct(product: VendorProduct): Promise<void> {
  await mutateMaybeScalar(`upsertVendorProduct(product: ${toGqlLiteral(product)})`)
}

export async function backendDeleteVendorProduct(productId: string): Promise<void> {
  await mutateMaybeScalar(`deleteVendorProduct(productId: ${toGqlLiteral(productId)})`)
}

export async function backendUpsertSourcingRule(rule: SourcingRule): Promise<void> {
  await mutateMaybeScalar(`upsertSourcingRule(rule: ${toGqlLiteral(rule)})`)
}

export async function backendDeleteSourcingRule(ruleId: string): Promise<void> {
  await mutateMaybeScalar(`deleteSourcingRule(ruleId: ${toGqlLiteral(ruleId)})`)
}

export async function backendUpsertPantryItem(item: PantryItem): Promise<void> {
  await mutateMaybeScalar(`upsertPantryItem(item: ${toGqlLiteral(item)})`)
}

export async function backendDeletePantryItem(itemId: string): Promise<void> {
  await mutateMaybeScalar(`deletePantryItem(itemId: ${toGqlLiteral(itemId)})`)
}

// ---------------------------
// Grocery status persistence
// ---------------------------

export async function backendSetGroceryLineStatus(key: string, status: GroceryLineStatus): Promise<void> {
  const args = gqlArgs({ key, status: gqlEnum(status) })
  await mutateMaybeScalar(`setGroceryLineStatus(${args})`)
}

export async function backendClearGroceryLineStatuses(): Promise<void> {
  await mutateMaybeScalar('clearGroceryLineStatuses')
}
