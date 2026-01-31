export type AppPage =
  | 'planBundle'
  | 'weekPlan'
  | 'analysis'
  | 'grocery'
  | 'prep'
  | 'supplements'
  | 'recipes'
  | 'foods'
  | 'people'
  | 'household'
  | 'settings'

export function pageLabel(page: AppPage): string {
  switch (page) {
    case 'planBundle':
      return 'Plan Bundle'
    case 'weekPlan':
      return 'Week Plan'
    case 'analysis':
      return 'Analysis'
    case 'grocery':
      return 'Grocery List'
    case 'prep':
      return 'Prep Plan'
    case 'supplements':
      return 'Supplements'
    case 'recipes':
      return 'Recipes'
    case 'foods':
      return 'Foods (FDC)'
    case 'people':
      return 'People & Targets'
    case 'household':
      return 'Household'
    case 'settings':
      return 'Settings'
    default:
      return String(page)
  }
}
