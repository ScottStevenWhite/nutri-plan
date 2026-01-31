export type Id = string

export type NutrientAmount = {
  nutrientId: number
  name: string
  unitName: string
  amount: number
}

export type FoodDetailsLite = {
  fdcId: number
  description: string
  dataType?: string
  brandOwner?: string
  servingSize?: number
  servingSizeUnit?: string
  // We assume FoodData Central amounts are normalized to 100g in most cases.
  // For some Branded foods, values may be derived from serving size label values.
  // This app scales using grams/100. Validate with your own spot checks.
  foodNutrients: NutrientAmount[]
  lastFetchedISO: string
}

export type Ingredient = {
  id: Id
  fdcId: number
  description: string
  grams: number
}

export type RecipeTag = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type Recipe = {
  id: Id
  name: string
  tags: RecipeTag[]
  ingredients: Ingredient[]
  notes?: string
}

export type DayPlan = {
  breakfastRecipeId?: Id
  lunchRecipeId?: Id
  dinnerRecipeId?: Id
  snackRecipeIds: Id[]
}

export type WeekPlan = {
  id: Id
  name: string
  startDateISO: string // just for display and future multi-week support
  days: DayPlan[] // length 7
}

export type NutrientTarget = {
  nutrientId: number
  name: string
  unitName: string
  daily: number
  weeklyOverride?: number
}


export type PersonProfile = {
  id: Id
  name: string

  sex: Sex
  dateOfBirthISO?: string // better than age hardcoding
  heightIn?: number

  currentWeightLb?: number
  targetWeightLb?: number
  activityLevel?: ActivityLevel

  pregnancy?: PregnancyMode // only meaningful for Ashley, but fine to keep generic
  notes?: string            // if you insist on ancestry, put it here

  nutrientTargets: Record<string, NutrientTarget>
}

  export type Sex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'very'
  | 'athlete'

export type PregnancyMode = {
  enabled: boolean
  trimester?: 1 | 2 | 3
  dueDateISO?: string // optional, but useful
  breastfeeding?: boolean
}

export type AppState = {
  version: number
  apiKey?: string
  selectedPersonId?: Id
  people: PersonProfile[]
  recipes: Recipe[]
  plan: WeekPlan
  foodCache: Record<string, FoodDetailsLite>
}

export type AppAction =
  | { type: 'HYDRATE'; state: AppState }
  | { type: 'SET_API_KEY'; apiKey: string }
  | { type: 'SELECT_PERSON'; personId: Id | undefined }
  | { type: 'UPSERT_PERSON'; person: PersonProfile }
  | { type: 'DELETE_PERSON'; personId: Id }
  | { type: 'UPSERT_RECIPE'; recipe: Recipe }
  | { type: 'DELETE_RECIPE'; recipeId: Id }
  | { type: 'SET_PLAN'; plan: WeekPlan }
  | { type: 'CACHE_FOOD'; food: FoodDetailsLite }
  | { type: 'CLEAR_ALL' }

