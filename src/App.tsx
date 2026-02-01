import React, { useMemo, useState } from 'react'
import { AppShell, Container } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

import type { AppPage } from './routes'
import { useAppState } from './state/AppStateContext'

import PlanBundlePage from './pages/PlanBundlePage'
import PlanPage from './pages/PlanPage'
import DashboardPage from './pages/DashboardPage'
import GroceryListPage from './pages/GroceryListPage'
import PrepPlanPage from './pages/PrepPlanPage'
import SupplementsPage from './pages/SupplementsPage'
import RecipesPage from './pages/RecipesPage'
import FoodsPage from './pages/FoodsPage'
import TargetsPage from './pages/TargetsPage'
import HouseholdPage from './pages/HouseholdPage'
import KitchenPage from './pages/KitchenPage'
import SettingsPage from './pages/SettingsPage'

import AppHeader from './layout/AppHeader'
import AppNavbar from './layout/AppNavbar'

export default function App() {
  const { state, backendStatus } = useAppState()
  const [page, setPage] = useState<AppPage>('planner')
  const [opened, { toggle, close }] = useDisclosure()

  const selectedPerson = useMemo(
    () => state.people.find(p => p.id === state.selectedPersonId),
    [state.people, state.selectedPersonId],
  )

  function go(p: AppPage) {
    setPage(p)
    close()
  }

  return (
    <AppShell
      header={{ height: 66 }}
      navbar={{
        width: 320,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <AppHeader
          opened={opened}
          onToggleNavbar={toggle}
          backendStatus={backendStatus}
          planName={state.plan.name}
          planStartDateISO={state.plan.startDateISO}
          personName={selectedPerson?.name}
          onOpenSettings={() => go('settings')}
        />
      </AppShell.Header>

      <AppShell.Navbar p="sm" bg="transparent">
        <AppNavbar page={page} navigate={go} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl" py="md">
          {page === 'planner' && <PlanBundlePage navigate={go} />}
          {page === 'weekPlan' && <PlanPage />}
          {page === 'review' && <DashboardPage />}
          {page === 'grocery' && <GroceryListPage navigate={go} />}
          {page === 'prep' && <PrepPlanPage navigate={go} />}

          {page === 'recipes' && <RecipesPage />}
          {page === 'foods' && <FoodsPage />}

          {page === 'people' && <TargetsPage />}
          {page === 'supplements' && <SupplementsPage />}
          {page === 'kitchen' && <KitchenPage />}
          {page === 'household' && <HouseholdPage />}

          {page === 'settings' && <SettingsPage />}
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
