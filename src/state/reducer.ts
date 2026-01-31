import type { AppAction, AppState, DayPlan, WeekPlan } from './types'
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

export function defaultState(): AppState {
  const scottId = uid()
  const ashleyId = uid()

  return {
    version: VERSION,
    apiKey: '',
    selectedPersonId: scottId,
    people: [
      {
        id: scottId,
        name: 'Scott',
        sex: 'male',
        currentWeightLb: 180,
        targetWeightLb: 155,
        pregnancy: { enabled: false },
        nutrientTargets: {},
        notes: 'Optional notes',
      },
      {
        id: ashleyId,
        name: 'Ashley',
        sex: 'female',
        currentWeightLb: 134,
        targetWeightLb: 120,
        pregnancy: { enabled: false },
        nutrientTargets: {},
        notes: 'Pregnancy mode will matter later.',
      },
    ],
    recipes: [],
    plan: emptyWeek(),
    foodCache: {},
  }
}

function coerceStateShape(state: any): any {
  if (!state || typeof state !== 'object') return state
  const out: any = { ...state }

  // foodCache might arrive as an array from GraphQL (e.g., [FoodDetailsLite])
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

  // nutrientTargets might arrive as an array per person
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
      return pp
    })
  }

  // Ensure plan day snack list exists
  if (out.plan?.days && Array.isArray(out.plan.days)) {
    out.plan = {
      ...out.plan,
      days: out.plan.days.map((d: any) => ({
        ...d,
        snackRecipeIds: Array.isArray(d.snackRecipeIds) ? d.snackRecipeIds : [],
      })),
    }
  }

  return out
}

export function migrateState(state: AppState): AppState {
  const s = coerceStateShape(state as any) as AppState

  if (!s?.version) return { ...defaultState(), ...s, version: VERSION }
  if (s.version === VERSION) return s

  if (s.version === 1) {
    const people = (s.people ?? []).map((p: any) => ({
      ...p,
      sex: p.sex ?? 'male',
      pregnancy: p.pregnancy ?? { enabled: false },
      notes: p.notes ?? '',
      nutrientTargets: p.nutrientTargets ?? {},
    }))

    return { ...s, version: VERSION, people }
  }

  return { ...defaultState(), ...s, version: VERSION }
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
