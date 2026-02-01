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

export type Sex = 'male' | 'female'

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete'

export type PregnancyMode = {
  enabled: boolean
  trimester?: 1 | 2 | 3
  dueDateISO?: string
  breastfeeding?: boolean
}

export type PrePregnancyMode = {
  enabled: boolean
  startDateISO?: string
  notes?: string
}

export type WeightEntry = {
  dateISO: string
  weightLb: number
}

export type SupplementCategory = 'supplement' | 'vitamin' | 'medication' | 'other'

export type Supplement = {
  id: Id
  name: string
  category: SupplementCategory | string
  dose?: number
  unit?: string
  schedule?: string
  notes?: string
}

export type PersonProfile = {
  id: Id
  name: string

  sex?: Sex
  dateOfBirthISO?: string
  heightIn?: number

  currentWeightLb?: number
  targetWeightLb?: number
  activityLevel?: ActivityLevel

  dietPattern?: string
  dietNotes?: string
  allergies: string[]
  supplements: Supplement[]
  weightLog: WeightEntry[]
  prePregnancy?: PrePregnancyMode
  targetsGeneratedISO?: string

  pregnancy?: PregnancyMode
  notes?: string

  // UI uses record; backend uses list. reducer migrates list->record on hydrate.
  nutrientTargets: Record<string, NutrientTarget>

  // computed by backend; NEVER send back in inputs
  watchouts: string[]
}

// ----------------------------
// Household + Grocery (Phase 1)
// ----------------------------

export type Quantity = {
  amount: number
  unit: string
}

export type VendorAvailability = {
  daysOfWeek?: number[]
  seasonMonths?: number[]
  orderCutoffDayOfWeek?: number
  notes?: string
}

export type Vendor = {
  id: Id
  name: string
  type: string
  notes?: string
  availability?: VendorAvailability
}

export type VendorProduct = {
  id: Id
  vendorId: Id
  name: string
  packageSize?: Quantity
  gramsPerPackage?: number
  tags: string[]
  notes?: string
}

export type SourcingRuleOption = {
  vendorProductId: Id
  priority?: number
  gramsPerPackage?: number
}

export type SourcingRule = {
  id: Id
  fdcId: number
  options: SourcingRuleOption[]
  notes?: string
}

export type PantryItem = {
  id: Id
  name: string
  fdcId?: number
  vendorProductId?: Id
  quantity?: Quantity
  grams?: number
  notes?: string
}

export type ShoppingPreferences = {
  vendorPriority: Id[]
  preferredPrepDay?: string
  maxStoreRunsPerWeek?: number
  notes?: string
}

// Household (UPDATED)
export type Household = {
  equipment: KitchenEquipmentCatalog
  vendors: Vendor[]
  vendorProducts: VendorProduct[]
  sourcingRules: SourcingRule[]
  pantry: PantryItem[]
  shoppingPreferences: ShoppingPreferences
}

export type GroceryLineStatus = 'need' | 'have' | 'bought' | 'skip'

export type GroceryLine = {
  key: Id
  status: GroceryLineStatus
  name: string
  fdcId?: number
  totalGrams?: number
  haveGrams?: number
  needGrams?: number

  vendorId?: Id
  vendorName?: string
  vendorProductId?: Id
  vendorProductName?: string

  packagesToBuy?: number
  gramsPerPackage?: number

  usedBy: string[]
  notes?: string
}

export type GroceryVendorSection = {
  vendorId?: Id
  vendorName: string
  lines: GroceryLine[]
}

export type GroceryList = {
  planId: Id
  generatedISO: string
  vendors: GroceryVendorSection[]
  warnings: string[]
}

export type FdcStatus = {
  hasApiKey: boolean
  source: string
}

export type EquipmentCare = {
  dishwasherSafe: string
  cleaningNeeds: string[]
  cleaningNotes?: string
}

export type EquipmentDefaults = {
  unitSystem: string
  tempUnit: string
  kitchenLocation?: string
  care?: EquipmentCare
}

export type KitchenEquipmentItem = {
  id: Id
  parentId?: Id

  name: string
  officialName?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  kitchenLocation?: string

  category: string
  subtype?: string
  categoryPath: string[]

  care?: EquipmentCare

  quantity?: number
  quantityNote?: string

  capabilities: string[]

  // JSONObject scalar -> keep as unknown/any
  specs?: any
  safety?: any
  notes?: string
}

export type KitchenEquipmentCatalog = {
  schemaVersion: string
  generatedAtLocalDate: string
  defaults: EquipmentDefaults
  items: KitchenEquipmentItem[]
}

export type AppState = {
  version: number
  apiKey?: string
  selectedPersonId?: Id

  people: PersonProfile[]
  recipes: Recipe[]
  plan: WeekPlan

  // UI uses record; backend returns list; reducer migrates list->record
  foodCache: Record<string, FoodDetailsLite>

  household: Household
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
