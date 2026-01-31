import { uid } from '../state/utils'
import { useLocalStorageState } from './useLocalStorageState'
export type EquipmentCapability =
  | 'blend'
  | 'bake'
  | 'pressureCook'
  | 'airFry'
  | 'stovetop'
  | 'grill'
  | 'microwave'
  | 'slowCook'

export type KitchenEquipment = {
  id: string
  name: string
  capabilities: EquipmentCapability[]
  notes?: string
}

export type VendorId =
  | 'azure-standard'
  | 'carmel-farmers-market'
  | 'kroger'
  | 'fresh-market'
  | 'niemann-harvest'

export type VendorType = 'delivery' | 'market' | 'grocery'

export type Vendor = {
  id: VendorId
  name: string
  type: VendorType
  notes?: string
}

export type PrepDay = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'

export type ShoppingPreferences = {
  vendorPriority: VendorId[]
  maxStoreRunsPerWeek: number
  prepDay: PrepDay
}

export type PantryItem = {
  id: string
  name: string
  /** Optional, but enables deterministic pantry subtraction in v0 */
  fdcId?: number
  /** Quantity is meaningful only with a unit. For v0, "g" is subtractable. */
  quantity?: number
  unit?: string // e.g. "g", "oz", "lb", "count"
  notes?: string
}

export type SourcingRule = {
  id: string
  /** v0 uses fdcId. Later you’ll likely move to CanonicalIngredient. */
  fdcId: number
  ingredientName: string
  vendorId?: VendorId
  productName?: string
  notes?: string
}

export type Household = {
  equipment: KitchenEquipment[]
  vendors: Vendor[]
  shoppingPreferences: ShoppingPreferences
  pantry: PantryItem[]
  sourcingRules: SourcingRule[]
}

export const DEFAULT_VENDORS: Vendor[] = [
  { id: 'azure-standard', name: 'Azure Standard', type: 'delivery' },
  { id: 'carmel-farmers-market', name: "Carmel Farmer's Market", type: 'market' },
  { id: 'kroger', name: 'Kroger', type: 'grocery' },
  { id: 'fresh-market', name: 'The Fresh Market', type: 'grocery' },
  { id: 'niemann-harvest', name: 'Niemann Harvest Market', type: 'grocery' },
]

export function defaultHousehold(): Household {
  return {
    equipment: [
      { id: uid(), name: 'Blender', capabilities: ['blend'] },
      { id: uid(), name: 'Oven', capabilities: ['bake'] },
      { id: uid(), name: 'Stovetop', capabilities: ['stovetop'] },
    ],
    vendors: DEFAULT_VENDORS,
    shoppingPreferences: {
      vendorPriority: ['azure-standard', 'carmel-farmers-market', 'kroger', 'fresh-market', 'niemann-harvest'],
      maxStoreRunsPerWeek: 1,
      prepDay: 'Sunday',
    },
    pantry: [],
    sourcingRules: [],
  }
}

export function useHousehold(): readonly [Household, (next: Household | ((prev: Household) => Household)) => void] {
  return useLocalStorageState<Household>('nutri-plan::household', defaultHousehold())
}

export function vendorLabel(v: Vendor | undefined): string {
  if (!v) return '—'
  return v.name
}

export function findSourcingRule(h: Household, fdcId: number): SourcingRule | undefined {
  return h.sourcingRules.find(r => r.fdcId === fdcId)
}

export function upsertSourcingRule(h: Household, rule: Omit<SourcingRule, 'id'> & { id?: string }): Household {
  const existing = h.sourcingRules.find(r => r.fdcId === rule.fdcId)
  const nextRule: SourcingRule = {
    id: existing?.id ?? rule.id ?? uid(),
    fdcId: rule.fdcId,
    ingredientName: rule.ingredientName,
    vendorId: rule.vendorId,
    productName: rule.productName,
    notes: rule.notes,
  }

  const sourcingRules = existing
    ? h.sourcingRules.map(r => (r.fdcId === rule.fdcId ? nextRule : r))
    : [...h.sourcingRules, nextRule]

  return { ...h, sourcingRules }
}
