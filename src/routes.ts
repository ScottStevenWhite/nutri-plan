export type AppPage =
  | 'planner'
  | 'weekPlan'
  | 'review'
  | 'grocery'
  | 'prep'
  | 'recipes'
  | 'foods'
  | 'people'
  | 'supplements'
  | 'kitchen'
  | 'household'
  | 'settings'

export function pageLabel(page: AppPage): string {
  switch (page) {
    case 'planner':
      return 'Slot Bundle'
    case 'weekPlan':
      return 'Edit Slots'
    case 'review':
      return 'Review'
    case 'grocery':
      return 'Grocery'
    case 'prep':
      return 'Prep'
    case 'recipes':
      return 'Recipes'
    case 'foods':
      return 'Foods (FDC)'
    case 'people':
      return 'Targets'
    case 'supplements':
      return 'Supplements & Meds'
    case 'kitchen':
      return 'Kitchen'
    case 'household':
      return 'Household'
    case 'settings':
      return 'Settings'
    default:
      return String(page)
  }
}
