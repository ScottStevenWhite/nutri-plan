import React, { useMemo, useState } from 'react'
import { AppShell, Badge, Burger, Container, Group, NavLink, Stack, Text, Title } from '@mantine/core'
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
import PeoplePage from './pages/PeoplePage'
import HouseholdPage from './pages/HouseholdPage'
import SettingsPage from './pages/SettingsPage'

function statusBadge(status: 'connecting' | 'online' | 'offline') {
  const color = status === 'online' ? 'green' : status === 'offline' ? 'red' : 'yellow'
  const label = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Connecting'
  return (
    <Badge variant="light" color={color}>
      Backend: {label}
    </Badge>
  )
}

export default function App() {
  const { state, backendStatus } = useAppState()
  const [page, setPage] = useState<AppPage>('planBundle')
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
      header={{ height: 56 }}
      navbar={{
        width: 290,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>Nutri Plan</Title>
          </Group>

          <Group gap="sm" wrap="nowrap">
            {statusBadge(backendStatus)}
            <Text size="sm" c="dimmed" visibleFrom="sm">
              Person: <strong>{selectedPerson?.name ?? 'None selected'}</strong>
            </Text>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" bg="white">
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Plan-first nutrition math (not a logging app).
          </Text>

          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={700}>
              PLAN
            </Text>
            <NavLink label="Plan Bundle" active={page === 'planBundle'} onClick={() => go('planBundle')} />
            <NavLink label="Week Plan" active={page === 'weekPlan'} onClick={() => go('weekPlan')} />
            <NavLink label="Analysis" active={page === 'analysis'} onClick={() => go('analysis')} />
            <NavLink label="Grocery List" active={page === 'grocery'} onClick={() => go('grocery')} />
            <NavLink label="Prep Plan" active={page === 'prep'} onClick={() => go('prep')} />
            <NavLink label="Supplements" active={page === 'supplements'} onClick={() => go('supplements')} />
          </Stack>

          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={700}>
              LIBRARY
            </Text>
            <NavLink label="Recipes" active={page === 'recipes'} onClick={() => go('recipes')} />
            <NavLink label="Foods (FDC)" active={page === 'foods'} onClick={() => go('foods')} />
          </Stack>

          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={700}>
              PROFILES
            </Text>
            <NavLink label="People & Targets" active={page === 'people'} onClick={() => go('people')} />
            <NavLink label="Household" active={page === 'household'} onClick={() => go('household')} />
          </Stack>

          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={700}>
              SYSTEM
            </Text>
            <NavLink label="Settings" active={page === 'settings'} onClick={() => go('settings')} />
          </Stack>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="lg" py="md">
          {page === 'planBundle' && <PlanBundlePage navigate={go} />}
          {page === 'weekPlan' && <PlanPage />}
          {page === 'analysis' && <DashboardPage />}
          {page === 'grocery' && <GroceryListPage navigate={go} />}
          {page === 'prep' && <PrepPlanPage navigate={go} />}
          {page === 'supplements' && <SupplementsPage />}

          {page === 'recipes' && <RecipesPage />}
          {page === 'foods' && <FoodsPage />}

          {page === 'people' && <PeoplePage />}
          {page === 'household' && <HouseholdPage />}

          {page === 'settings' && <SettingsPage />}
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
