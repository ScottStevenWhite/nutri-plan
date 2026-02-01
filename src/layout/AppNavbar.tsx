import React, { useMemo } from 'react'
import { Badge, Divider, Group, NavLink, Paper, ScrollArea, Stack, Text, ThemeIcon } from '@mantine/core'
import type { AppPage } from '../routes'
import { useAppState } from '../state/AppStateContext'

function icon(emoji: string, color: string) {
  return (
    <ThemeIcon variant="light" radius="md" color={color} size={30}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
    </ThemeIcon>
  )
}

type NavItem = {
  page: AppPage
  label: string
  description?: string
  left: React.ReactNode
}

type NavGroup = {
  title: string
  items: NavItem[]
}

type Props = {
  page: AppPage
  navigate: (p: AppPage) => void
}

export default function AppNavbar({ page, navigate }: Props) {
  const { state } = useAppState()

  const selectedPerson = useMemo(
    () => state.people.find(p => p.id === state.selectedPersonId),
    [state.people, state.selectedPersonId],
  )

  const summaryBadges = useMemo(() => {
    const cachedFoods = Object.keys(state.foodCache ?? {}).length
    return {
      recipes: state.recipes.length,
      cachedFoods,
      vendors: state.household.vendors.length,
      pantry: state.household.pantry.length,
      equipment: state.household.equipment.items.length,
    }
  }, [state])

  const groups: NavGroup[] = [
    {
      title: 'CORE',
      items: [
        {
          page: 'planner',
          label: 'Slot Bundle',
          description: 'Request counts → generate',
          left: icon('🧩', 'brand'),
        },
        {
          page: 'weekPlan',
          label: 'Edit Slots',
          description: 'Manual overrides',
          left: icon('🧷', 'blue'),
        },
        {
          page: 'review',
          label: 'Review',
          description: 'Targets vs actual',
          left: icon('📊', 'grape'),
        },
      ],
    },
    {
      title: 'EXECUTION',
      items: [
        {
          page: 'grocery',
          label: 'Grocery',
          description: 'Derived list + statuses',
          left: icon('🛒', 'orange'),
        },
        {
          page: 'prep',
          label: 'Prep',
          description: 'Tasks for the bundle',
          left: icon('🧑‍🍳', 'teal'),
        },
      ],
    },
    {
      title: 'LIBRARY',
      items: [
        { page: 'recipes', label: 'Recipes', left: icon('📚', 'indigo') },
        { page: 'foods', label: 'Foods (FDC)', left: icon('🥦', 'green') },
      ],
    },
    {
      title: 'TARGETS',
      items: [
        { page: 'people', label: 'Targets', description: 'Presets, macros, micros', left: icon('🎯', 'cyan') },
        { page: 'supplements', label: 'Supplements & Meds', left: icon('💊', 'pink') },
      ],
    },
    {
      title: 'HOME OPS',
      items: [
        {
          page: 'kitchen',
          label: 'Kitchen',
          description: 'Supplies & tools',
          left: icon('🍳', 'lime'),
        },
        {
          page: 'household',
          label: 'Household',
          description: 'Vendors, pantry, products',
          left: icon('🏠', 'gray'),
        },
      ],
    },
    {
      title: 'SYSTEM',
      items: [{ page: 'settings', label: 'Settings', left: icon('🧩', 'dark') }],
    },
  ]

  return (
    <Paper withBorder radius="lg" shadow="sm" p="sm" bg="white" h="100%">
      <Stack gap="sm" h="100%">
        <Paper radius="md" p="sm" bg="var(--mantine-color-gray-0)" withBorder>
          <Group justify="space-between" wrap="nowrap">
            <div style={{ minWidth: 0 }}>
              <Text fw={800} lineClamp={1}>
                {state.plan.name || 'Slot Bundle'}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={1}>
                Person: {selectedPerson?.name ?? 'None'} · created {state.plan.startDateISO}
              </Text>
            </div>
            <Badge variant="light">{summaryBadges.recipes} recipes</Badge>
          </Group>

          <Group gap={6} mt="xs" wrap="wrap">
            <Badge variant="light">{summaryBadges.cachedFoods} foods</Badge>
            <Badge variant="light">{summaryBadges.pantry} pantry</Badge>
            <Badge variant="light">{summaryBadges.vendors} vendors</Badge>
            <Badge variant="light">{summaryBadges.equipment} tools</Badge>
          </Group>
        </Paper>

        <Divider />

        <ScrollArea style={{ flex: 1 }} offsetScrollbars>
          <Stack gap="md">
            {groups.map(g => (
              <Stack key={g.title} gap={6}>
                <Text size="xs" fw={900} c="dimmed" style={{ letterSpacing: 0.8 }}>
                  {g.title}
                </Text>

                <Stack gap={4}>
                  {g.items.map(it => (
                    <NavLink
                      key={it.page}
                      active={page === it.page}
                      label={it.label}
                      description={it.description}
                      leftSection={it.left}
                      onClick={() => navigate(it.page)}
                    />
                  ))}
                </Stack>
              </Stack>
            ))}
          </Stack>
        </ScrollArea>

        <Text size="xs" c="dimmed">
          Strong opinion: default should be “generate + tweak,” not “manually fill a calendar.”
        </Text>
      </Stack>
    </Paper>
  )
}
