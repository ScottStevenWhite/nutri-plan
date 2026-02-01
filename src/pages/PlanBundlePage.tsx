import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Checkbox,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'

import type { AppPage } from '../routes'
import { useAppState } from '../state/AppStateContext'
import { pickMacroSnapshot, weekTotals } from '../state/calc'
import { clamp, formatNumber } from '../state/utils'
import { planCompleteness } from '../derive/plan'
import { computePrepTasks } from '../derive/prep'
import { useLocalStorageState } from '../local/useLocalStorageState'
import type { GroceryList } from '../state/types'
import { fetchGroceryList } from '../backend/api'
import { countBundleAssignments, generateSlotBundle, snackDaysFromCounts } from '../plan/generateSlotBundle'

type Props = {
  navigate: (page: AppPage) => void
}

export default function PlanBundlePage({ navigate }: Props) {
  const { state, dispatch } = useAppState()

  const recipesById = useMemo(() => {
    const m: Record<string, any> = {}
    for (const r of state.recipes) m[r.id] = r
    return m
  }, [state.recipes])

  const completeness = useMemo(() => planCompleteness(state.plan), [state.plan])
  const totals = useMemo(
    () => weekTotals(state.plan, recipesById, state.foodCache),
    [state.plan, recipesById, state.foodCache],
  )
  const macros = useMemo(() => pickMacroSnapshot(totals), [totals])

  const assignmentCounts = useMemo(() => countBundleAssignments(state.plan), [state.plan])

  // Prep stays local until backend ships it
  const prepTasks = useMemo(() => computePrepTasks(state.plan, recipesById), [state.plan, recipesById])
  const [prepDone] = useLocalStorageState<Record<string, boolean>>(`nutri-plan::prepDone::${state.plan.id}`, {})

  const prepSummary = useMemo(() => {
    const done = prepTasks.filter(t => prepDone[t.id])
    return { taskCount: prepTasks.length, doneCount: done.length }
  }, [prepTasks, prepDone])

  // Grocery summary from backend list
  const [grocery, setGrocery] = useState<GroceryList | null>(null)

  useEffect(() => {
    fetchGroceryList()
      .then(setGrocery)
      .catch(() => setGrocery(null))
  }, [state.plan.id])

  const grocerySummary = useMemo(() => {
    const counts = { need: 0, have: 0, bought: 0, skip: 0 }
    for (const sec of grocery?.vendors ?? []) {
      for (const l of sec.lines ?? []) counts[l.status]++
    }
    return counts
  }, [grocery])

  const mealFillPct =
    completeness.totalMealSlots > 0 ? (completeness.filledMealSlots / completeness.totalMealSlots) * 100 : 0

  // -------- Generator request (frontend-first) --------
  const [bCount, setBCount] = useState<number | ''>(7)
  const [lCount, setLCount] = useState<number | ''>(7)
  const [dCount, setDCount] = useState<number | ''>(7)
  const [includeSnacks, setIncludeSnacks] = useState(true)

  const snackDays = useMemo(() => {
    const b = typeof bCount === 'number' ? bCount : 0
    const l = typeof lCount === 'number' ? lCount : 0
    const d = typeof dCount === 'number' ? dCount : 0
    return includeSnacks ? snackDaysFromCounts(b, l, d) : 0
  }, [bCount, lCount, dCount, includeSnacks])

  const taggedCounts = useMemo(() => {
    const recipes = state.recipes
    const countByTag = (tag: string) => recipes.filter(r => (r.tags ?? []).includes(tag as any)).length
    return {
      breakfast: countByTag('breakfast'),
      lunch: countByTag('lunch'),
      dinner: countByTag('dinner'),
      snack: countByTag('snack'),
    }
  }, [state.recipes])

  function runGenerate() {
    if (state.recipes.length === 0) return

    const b = typeof bCount === 'number' && Number.isFinite(bCount) ? bCount : 0
    const l = typeof lCount === 'number' && Number.isFinite(lCount) ? lCount : 0
    const d = typeof dCount === 'number' && Number.isFinite(dCount) ? dCount : 0

    const next = generateSlotBundle(
      state.recipes,
      { breakfasts: b, lunches: l, dinners: d, includeSnacks },
      { name: state.plan.name || 'Slot Bundle', allowRepeats: true, preferTags: true },
    )

    dispatch({ type: 'SET_PLAN', plan: next })

    notifications.show({
      title: 'Generated slot bundle',
      message: `Breakfasts: ${Math.min(7, Math.max(0, b))}, Lunches: ${Math.min(7, Math.max(0, l))}, Dinners: ${Math.min(
        7,
        Math.max(0, d),
      )}, Snacks: ${snackDays} days`,
      color: 'green',
    })
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Slot Bundle</Title>
          <Text c="dimmed" size="sm">
            Request counts → generate → review → execute.
          </Text>
        </div>
        <Group gap="xs">
          <Badge variant="light">Bundle: {state.plan.name}</Badge>
          <Badge variant="light">Created: {state.plan.startDateISO}</Badge>
        </Group>
      </Group>

      <Card p="md">
        <Group justify="space-between" wrap="wrap" align="flex-start">
          <div>
            <Title order={4}>Generator request</Title>
            <Text c="dimmed" size="sm" mt={4}>
              v0 generates by picking recipes (tagged if possible), then fills slots sequentially (Slot 1 → Slot 7).
            </Text>
          </div>

          <Group gap="xs" wrap="wrap">
            <Badge variant="light">{state.recipes.length} recipes</Badge>
            <Badge variant="light">Snacks: {snackDays} days</Badge>
          </Group>
        </Group>

        {state.recipes.length === 0 ? (
          <Alert mt="md" color="yellow" title="No recipes yet">
            Add recipes first. Generation needs something to pick from.
          </Alert>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="md">
              <NumberInput
                label="Breakfasts (0–7)"
                value={bCount}
                onChange={setBCount}
                min={0}
                max={7}
                step={1}
                clampBehavior="strict"
                description={`${taggedCounts.breakfast} tagged breakfast recipes`}
              />
              <NumberInput
                label="Lunches (0–7)"
                value={lCount}
                onChange={setLCount}
                min={0}
                max={7}
                step={1}
                clampBehavior="strict"
                description={`${taggedCounts.lunch} tagged lunch recipes`}
              />
              <NumberInput
                label="Dinners (0–7)"
                value={dCount}
                onChange={setDCount}
                min={0}
                max={7}
                step={1}
                clampBehavior="strict"
                description={`${taggedCounts.dinner} tagged dinner recipes`}
              />
            </SimpleGrid>

            <Group mt="md" wrap="wrap" justify="space-between" align="flex-end">
              <Checkbox
                checked={includeSnacks}
                onChange={e => setIncludeSnacks(e.currentTarget.checked)}
                label="Include snacks"
              />

              <div style={{ minWidth: 260 }}>
                <Text size="sm" fw={700}>
                  Snacks days (A): {snackDays}
                </Text>
                <Text size="xs" c="dimmed">
                  A = round((breakfasts + lunches + dinners) / 3), clamped to 0–7
                </Text>
              </div>

              <Group>
                <Button variant="default" onClick={() => navigate('weekPlan')}>
                  Edit slots
                </Button>
                <Button onClick={runGenerate}>Generate</Button>
              </Group>
            </Group>
          </>
        )}
      </Card>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Card p="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={900}>Bundle status</Text>
            <Badge variant="light">
              {assignmentCounts.breakfasts}/{7} B · {assignmentCounts.lunches}/{7} L · {assignmentCounts.dinners}/{7} D
            </Badge>
          </Group>

          <Progress mt="sm" value={clamp(mealFillPct, 0, 100)} />

          <Text c="dimmed" size="sm" mt="sm">
            This is still stored as 7 “days” in v0. We just treat them as slots instead of a calendar.
          </Text>

          <Divider my="md" />
          <Group>
            <Button variant="default" onClick={() => navigate('review')}>
              Review
            </Button>
            <Button variant="default" onClick={() => navigate('people')}>
              Targets
            </Button>
          </Group>
        </Card>

        <Card p="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={900}>Nutrition</Text>
            <Badge variant="light">Bundle totals</Badge>
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
          <Button variant="default" onClick={() => navigate('review')}>
            Open review
          </Button>
        </Card>

        <Card p="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={900}>Execution</Text>
            <Badge variant="light">Operational</Badge>
          </Group>

          <Stack gap={10} mt="sm">
            <Group justify="space-between">
              <Text size="sm">Grocery</Text>
              <Group gap="xs">
                <Badge variant="light" color={grocerySummary.need > 0 ? 'yellow' : 'green'}>
                  {grocerySummary.need} need
                </Badge>
                <Badge variant="light">{grocerySummary.bought} bought</Badge>
              </Group>
            </Group>

            <Group justify="space-between">
              <Text size="sm">Prep</Text>
              <Badge variant="light">
                {prepSummary.doneCount}/{prepSummary.taskCount} done
              </Badge>
            </Group>
          </Stack>

          <Divider my="md" />

          <Stack gap="xs">
            <Button variant="default" onClick={() => navigate('grocery')}>
              Open grocery
            </Button>
            <Button variant="default" onClick={() => navigate('prep')}>
              Open prep
            </Button>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}
