import React, { useMemo } from 'react'
import { Badge, Button, Card, Divider, Group, Progress, SimpleGrid, Stack, Text, Title } from '@mantine/core'

import type { AppPage } from '../routes'
import { useAppState } from '../state/AppStateContext'
import { pickMacroSnapshot, weekTotals } from '../state/calc'
import { clamp, formatNumber, todayISO } from '../state/utils'
import { planCompleteness } from '../derive/plan'
import { computePrepTasks } from '../derive/prep'
import { useLocalStorageState } from '../local/useLocalStorageState';

type Props = {
  navigate: (page: AppPage) => void
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

type GroceryStatus = 'need' | 'have' | 'bought' | 'skip'
type GroceryStatusMap = Record<string, GroceryStatus>

type SupplementSchedule = 'daily' | 'monWedFri' | 'asNeeded'
type SupplementPlanItem = {
  id: string
  personId: string | 'household'
  name: string
  dose?: string
  schedule: SupplementSchedule
  enabled: boolean
}
type SupplementChecks = Record<string, string[]> // dateISO -> completed item IDs

function weekdayIndex(dateISO: string): number {
  const d = new Date(`${dateISO}T12:00:00`)
  // JS: 0=Sun..6=Sat. Convert to 1..7 with Mon=1
  const js = d.getDay()
  const monFirst = js === 0 ? 7 : js
  return monFirst
}

function isDue(schedule: SupplementSchedule, dateISO: string): boolean {
  if (schedule === 'daily') return true
  if (schedule === 'monWedFri') {
    const idx = weekdayIndex(dateISO) // Mon=1..Sun=7
    return idx === 1 || idx === 3 || idx === 5
  }
  return false
}

export default function PlanBundlePage({ navigate }: Props) {
  const { state } = useAppState()

  const recipesById = useMemo(() => {
    const m: Record<string, any> = {}
    for (const r of state.recipes) m[r.id] = r
    return m
  }, [state.recipes])

  const completeness = useMemo(() => planCompleteness(state.plan), [state.plan])
  const totals = useMemo(() => weekTotals(state.plan, recipesById, state.foodCache), [state.plan, recipesById, state.foodCache])
  const macros = useMemo(() => pickMacroSnapshot(totals), [totals])

  const perPerson = useMemo(() => {
    return state.people.map(p => {
      const targets = Object.values(p.nutrientTargets ?? {})
      let under = 0
      let over = 0

      for (const t of targets) {
        const actual = totals[String(t.nutrientId)]?.amount ?? 0
        const weeklyTarget = t.weeklyOverride ?? t.daily * 7
        if (actual < weeklyTarget) under++
        if (actual > weeklyTarget) over++
      }

      return { person: p, targetsCount: targets.length, under, over }
    })
  }, [state.people, totals])

  // v0: local-only grocery + prep + supplements statuses
  const [groceryStatus] = useLocalStorageState<GroceryStatusMap>(`nutri-plan::groceryStatus::${state.plan.id}`, {})
  const prepTasks = useMemo(() => computePrepTasks(state.plan, recipesById), [state.plan, recipesById])
  const [prepDone] = useLocalStorageState<Record<string, boolean>>(`nutri-plan::prepDone::${state.plan.id}`, {})

  const [suppPlan] = useLocalStorageState<SupplementPlanItem[]>('nutri-plan::supplementPlanItems', [])
  const [suppChecks] = useLocalStorageState<SupplementChecks>('nutri-plan::supplementChecks', {})
  const today = todayISO()

  const supplementSummary = useMemo(() => {
    const due = suppPlan.filter(i => i.enabled && isDue(i.schedule, today))
    const doneIds = new Set(suppChecks[today] ?? [])
    const done = due.filter(i => doneIds.has(i.id))
    return { dueCount: due.length, doneCount: done.length }
  }, [suppPlan, suppChecks, today])

  const prepSummary = useMemo(() => {
    const done = prepTasks.filter(t => prepDone[t.id])
    return { taskCount: prepTasks.length, doneCount: done.length }
  }, [prepTasks, prepDone])

  const grocerySummary = useMemo(() => {
    const entries = Object.entries(groceryStatus)
    const counts = { need: 0, have: 0, bought: 0, skip: 0 }
    for (const [, s] of entries) {
      if (s === 'need') counts.need++
      else if (s === 'have') counts.have++
      else if (s === 'bought') counts.bought++
      else if (s === 'skip') counts.skip++
    }
    return counts
  }, [groceryStatus])

  const mealFillPct = completeness.totalMealSlots > 0 ? (completeness.filledMealSlots / completeness.totalMealSlots) * 100 : 0

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Plan Bundle</Title>
          <Text c="dimmed" size="sm">
            One place to answer: “Is the week sane?” then shop and prep.
          </Text>
        </div>
        <Group gap="xs">
          <Badge variant="light">Week: {state.plan.name}</Badge>
          <Badge variant="light">Start: {state.plan.startDateISO}</Badge>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        {/* Week summary */}
        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={700}>Week plan</Text>
            <Badge variant="light">
              {completeness.filledMealSlots}/{completeness.totalMealSlots} filled
            </Badge>
          </Group>

          <Progress mt="sm" value={clamp(mealFillPct, 0, 100)} />

          {completeness.missingMealSlots > 0 ? (
            <Stack gap={4} mt="sm">
              <Text c="dimmed" size="sm">
                Missing {completeness.missingMealSlots} meal slots:
              </Text>
              {completeness.missingByDay.slice(0, 4).map(x => (
                <Text key={x.dayIndex} size="sm">
                  • {DAY_NAMES[x.dayIndex]}: {x.missing.join(', ')}
                </Text>
              ))}
              {completeness.missingByDay.length > 4 && (
                <Text c="dimmed" size="sm">
                  …and {completeness.missingByDay.length - 4} more days.
                </Text>
              )}
            </Stack>
          ) : (
            <Text c="dimmed" size="sm" mt="sm">
              All meals assigned. Good.
            </Text>
          )}

          <Divider my="md" />

          <Group>
            <Button variant="default" onClick={() => navigate('weekPlan')}>
              Edit week
            </Button>
            <Button variant="default" onClick={() => navigate('analysis')}>
              View analysis
            </Button>
          </Group>
        </Card>

        {/* Nutrition health check */}
        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={700}>Nutrition</Text>
            <Badge variant="light">Week totals</Badge>
          </Group>

          <Stack gap={6} mt="sm">
            <Text size="sm">
              Calories: <strong>{formatNumber(macros.calories ?? NaN)} kcal</strong>
            </Text>
            <Text size="sm">
              Protein: <strong>{formatNumber(macros.protein ?? NaN)} g</strong>
            </Text>
            <Text size="sm">
              Fiber: <strong>{formatNumber(macros.fiber ?? NaN)} g</strong>
            </Text>
          </Stack>

          <Divider my="md" />

          <Text fw={650} size="sm">
            Deficits by person (same plan, different targets)
          </Text>

          <Stack gap={6} mt="sm">
            {perPerson.map(x => (
              <Group key={x.person.id} justify="space-between" wrap="nowrap">
                <Text size="sm" fw={650}>
                  {x.person.name}
                </Text>
                <Group gap="xs">
                  <Badge variant="light">{x.targetsCount} targets</Badge>
                  <Badge variant="light" color={x.under > 0 ? 'yellow' : 'green'}>
                    {x.under} under
                  </Badge>
                </Group>
              </Group>
            ))}
          </Stack>

          <Divider my="md" />

          <Button variant="default" onClick={() => navigate('people')}>
            Edit targets
          </Button>
        </Card>

        {/* Operational readiness */}
        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={700}>Execution</Text>
            <Badge variant="light">Operational</Badge>
          </Group>

          <Stack gap={10} mt="sm">
            <Group justify="space-between">
              <Text size="sm">Grocery list</Text>
              <Group gap="xs">
                <Badge variant="light" color={grocerySummary.need > 0 ? 'yellow' : 'green'}>
                  {grocerySummary.need} need
                </Badge>
                <Badge variant="light">{grocerySummary.bought} bought</Badge>
              </Group>
            </Group>

            <Group justify="space-between">
              <Text size="sm">Prep tasks</Text>
              <Badge variant="light">
                {prepSummary.doneCount}/{prepSummary.taskCount} done
              </Badge>
            </Group>

            <Group justify="space-between">
              <Text size="sm">Supplements today</Text>
              <Badge variant="light">
                {supplementSummary.doneCount}/{supplementSummary.dueCount} done
              </Badge>
            </Group>
          </Stack>

          <Divider my="md" />

          <Stack gap="xs">
            <Button variant="default" onClick={() => navigate('grocery')}>
              Open grocery list
            </Button>
            <Button variant="default" onClick={() => navigate('prep')}>
              Open prep plan
            </Button>
            <Button variant="default" onClick={() => navigate('supplements')}>
              Open supplements
            </Button>
          </Stack>

          <Text c="dimmed" size="xs" mt="sm">
            Note: Grocery/Prep/Supplements are v0 local-only until the backend exposes PlanBundle APIs.
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}
