import type { AppState, AppAction, DayPlan, Household, KitchenEquipmentCatalog, PersonProfile, WeekPlan } from './types'
import { todayISO, uid } from './utils'

const VERSION = 2

function emptyWeek(): WeekPlan {
  const blankDay: DayPlan = { snackRecipeIds: [] }
  return {
    id: uid(),
    name: 'This Week',
    startDateISO: todayISO(),
    days: Array.from({ length: 7 }, () => ({ ...blankDay })),
  }
}

function defaultHousehold(): Household {
  const vendors = [
    { id: 'azure-standard', name: 'Azure Standard', type: 'delivery' },
    { id: 'carmel-farmers-market', name: "Carmel Farmer's Market", type: 'market' },
    { id: 'kroger', name: 'Kroger', type: 'grocery' },
    { id: 'fresh-market', name: 'The Fresh Market', type: 'grocery' },
    { id: 'niemann-harvest', name: 'Niemann Harvest Market', type: 'grocery' },
  ]

  return {
    equipment: defaultEquipment(),
    vendors,
    vendorProducts: [],
    sourcingRules: [],
    pantry: [],
    shoppingPreferences: {
      vendorPriority: vendors.map(v => v.id),
      preferredPrepDay: 'Sunday',
      maxStoreRunsPerWeek: 1,
      notes: '',
    },
  }
}

export function defaultState(): AppState {
  const scottId = uid()
  const ashleyId = uid()

  const basePerson = (id: string, name: string, sex?: 'male' | 'female'): PersonProfile => ({
    id,
    name,
    sex,
    allergies: [],
    supplements: [],
    weightLog: [],
    pregnancy: { enabled: false },
    nutrientTargets: {},
    watchouts: [],
    notes: '',
  })

  return {
    version: VERSION,
    apiKey: '',
    selectedPersonId: scottId,
    people: [
      {
        ...basePerson(scottId, 'Scott', 'male'),
        currentWeightLb: 180,
        targetWeightLb: 155,
      },
      {
        ...basePerson(ashleyId, 'Ashley', 'female'),
        currentWeightLb: 134,
        targetWeightLb: 120,
        notes: 'Pregnancy mode will matter later.',
      },
    ],
    recipes: [],
    plan: emptyWeek(),
    foodCache: {},
    household: defaultHousehold(),
  }
}

function coerceStateShape(state: any): any {
  if (!state || typeof state !== 'object') return state
  const out: any = { ...state }

  // foodCache might arrive as an array from GraphQL ([FoodDetailsLite])
  const fc = out.foodCache ?? out.cachedFoods
  if (Array.isArray(fc)) {
    const map: Record<string, any> = {}
    for (const f of fc) {
      if (!f?.fdcId) continue
      map[String(f.fdcId)] = f
    }
    out.foodCache = map
  } else if (!out.foodCache || typeof out.foodCache !== 'object') {
    out.foodCache = {}
  }

  // people: nutrientTargets might arrive as an array per person; ensure arrays exist
  if (Array.isArray(out.people)) {
    out.people = out.people.map((p: any) => {
      const pp: any = { ...p }

      const nt = pp.nutrientTargets
      if (Array.isArray(nt)) {
        const rec: Record<string, any> = {}
        for (const t of nt) {
          if (!t?.nutrientId) continue
          rec[String(t.nutrientId)] = t
        }
        pp.nutrientTargets = rec
      } else if (!pp.nutrientTargets || typeof pp.nutrientTargets !== 'object') {
        pp.nutrientTargets = {}
      }

      if (!pp.pregnancy) pp.pregnancy = { enabled: false }

      pp.allergies = Array.isArray(pp.allergies) ? pp.allergies.map((x: any) => String(x)) : []
      pp.supplements = Array.isArray(pp.supplements) ? pp.supplements : []
      pp.weightLog = Array.isArray(pp.weightLog) ? pp.weightLog : []
      pp.watchouts = Array.isArray(pp.watchouts) ? pp.watchouts.map((x: any) => String(x)) : []

      return pp
    })
  }

  // plan: ensure snackRecipeIds exists
  if (out.plan?.days && Array.isArray(out.plan.days)) {
    out.plan = {
      ...out.plan,
      days: out.plan.days.map((d: any) => ({
        ...d,
        snackRecipeIds: Array.isArray(d.snackRecipeIds) ? d.snackRecipeIds : [],
      })),
    }
  }

  // household: ensure shape + defaults
  const h = out.household
  if (!h || typeof h !== 'object') {
    out.household = defaultHousehold()
  } else {
    const vendors = Array.isArray(h.vendors) ? h.vendors : []
    const equipment = h.equipment && typeof h.equipment === 'object' ? h.equipment : defaultEquipment()

    out.household = {
      equipment: {
        schemaVersion: String(equipment.schemaVersion ?? '1'),
        generatedAtLocalDate: String(equipment.generatedAtLocalDate ?? todayISO()),
        defaults: {
          unitSystem: String(equipment.defaults?.unitSystem ?? 'us'),
          tempUnit: String(equipment.defaults?.tempUnit ?? 'F'),
          kitchenLocation: equipment.defaults?.kitchenLocation ?? '',
          care: equipment.defaults?.care
            ? {
              dishwasherSafe: String(equipment.defaults.care.dishwasherSafe ?? 'unknown'),
              cleaningNeeds: Array.isArray(equipment.defaults.care.cleaningNeeds) ? equipment.defaults.care.cleaningNeeds : [],
              cleaningNotes: equipment.defaults.care.cleaningNotes ?? '',
            }
            : { dishwasherSafe: 'unknown', cleaningNeeds: [], cleaningNotes: '' },
        },
        items: Array.isArray(equipment.items)
          ? equipment.items.map((it: any) => ({
            ...it,
            categoryPath: Array.isArray(it.categoryPath) ? it.categoryPath : [],
            capabilities: Array.isArray(it.capabilities) ? it.capabilities : [],
            care: it.care
              ? {
                dishwasherSafe: String(it.care.dishwasherSafe ?? 'unknown'),
                cleaningNeeds: Array.isArray(it.care.cleaningNeeds) ? it.care.cleaningNeeds : [],
                cleaningNotes: it.care.cleaningNotes ?? '',
              }
              : undefined,
          }))
          : [],
      },
      vendors,
      vendorProducts: Array.isArray(h.vendorProducts) ? h.vendorProducts.map((p: any) => ({ ...p, tags: Array.isArray(p?.tags) ? p.tags : [] })) : [],
      sourcingRules: Array.isArray(h.sourcingRules) ? h.sourcingRules : [],
      pantry: Array.isArray(h.pantry) ? h.pantry : [],
      shoppingPreferences:
        h.shoppingPreferences && typeof h.shoppingPreferences === 'object'
          ? {
            vendorPriority: Array.isArray(h.shoppingPreferences.vendorPriority) ? h.shoppingPreferences.vendorPriority : vendors.map((v: any) => v.id),
            preferredPrepDay: h.shoppingPreferences.preferredPrepDay ?? 'Sunday',
            maxStoreRunsPerWeek: typeof h.shoppingPreferences.maxStoreRunsPerWeek === 'number' ? h.shoppingPreferences.maxStoreRunsPerWeek : 1,
            notes: h.shoppingPreferences.notes ?? '',
          }
          : {
            vendorPriority: vendors.map((v: any) => v.id),
            preferredPrepDay: 'Sunday',
            maxStoreRunsPerWeek: 1,
            notes: '',
          },
    }
  }


  return out
}

export function migrateState(state: AppState): AppState {
  const s = coerceStateShape(state as any) as AppState

  if (!s?.version) return { ...defaultState(), ...s, version: VERSION }
  if (s.version === VERSION) return s

  // Keep old migrations intact; coerceStateShape already fixes new fields.
  if (s.version === 1) {
    return { ...s, version: VERSION }
  }

  return { ...defaultState(), ...s, version: VERSION }
}

function defaultEquipment(): KitchenEquipmentCatalog {
  return {
    schemaVersion: '1',
    generatedAtLocalDate: todayISO(),
    defaults: {
      unitSystem: 'us',
      tempUnit: 'F',
      kitchenLocation: '',
      care: { dishwasherSafe: 'unknown', cleaningNeeds: [], cleaningNotes: '' },
    },
    items: [],
  }
}


export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return migrateState(action.state)

    case 'SET_API_KEY':
      return { ...state, apiKey: action.apiKey }

    case 'SELECT_PERSON':
      return { ...state, selectedPersonId: action.personId }

    case 'UPSERT_PERSON': {
      const exists = state.people.some(p => p.id === action.person.id)
      const people = exists
        ? state.people.map(p => (p.id === action.person.id ? action.person : p))
        : [...state.people, action.person]
      const selectedPersonId = state.selectedPersonId ?? action.person.id
      return { ...state, people, selectedPersonId }
    }

    case 'DELETE_PERSON': {
      const people = state.people.filter(p => p.id !== action.personId)
      const selectedPersonId =
        state.selectedPersonId === action.personId ? people[0]?.id : state.selectedPersonId
      return { ...state, people, selectedPersonId }
    }

    case 'UPSERT_RECIPE': {
      const exists = state.recipes.some(r => r.id === action.recipe.id)
      const recipes = exists
        ? state.recipes.map(r => (r.id === action.recipe.id ? action.recipe : r))
        : [...state.recipes, action.recipe]
      return { ...state, recipes }
    }

    case 'DELETE_RECIPE': {
      const recipes = state.recipes.filter(r => r.id !== action.recipeId)

      const plan: WeekPlan = {
        ...state.plan,
        days: state.plan.days.map(d => ({
          ...d,
          breakfastRecipeId: d.breakfastRecipeId === action.recipeId ? undefined : d.breakfastRecipeId,
          lunchRecipeId: d.lunchRecipeId === action.recipeId ? undefined : d.lunchRecipeId,
          dinnerRecipeId: d.dinnerRecipeId === action.recipeId ? undefined : d.dinnerRecipeId,
          snackRecipeIds: d.snackRecipeIds.filter(id => id !== action.recipeId),
        })),
      }

      return { ...state, recipes, plan }
    }

    case 'SET_PLAN':
      return { ...state, plan: action.plan }

    case 'CACHE_FOOD':
      return {
        ...state,
        foodCache: {
          ...state.foodCache,
          [String(action.food.fdcId)]: action.food,
        },
      }

    case 'CLEAR_ALL':
      return defaultState()

    default:
      return state
  }
}
