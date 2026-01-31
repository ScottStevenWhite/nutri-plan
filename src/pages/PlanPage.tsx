import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Group, ScrollArea, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { useAppState } from '../state/AppStateContext'
import type { DayPlan, WeekPlan } from '../state/types'
import { uid } from '../state/utils'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export default function PlanPage() {
  const { state, dispatch } = useAppState()
  const [planName, setPlanName] = useState(state.plan.name)

  // keep local input in sync when plan changes from hydration/reset
  useEffect(() => {
    setPlanName(state.plan.name)
  }, [state.plan.id])

  const recipeOptions = useMemo(
    () =>
      state.recipes
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(r => ({ value: r.id, label: r.name })),
    [state.recipes],
  )

  function savePlan(updated: WeekPlan) {
    dispatch({ type: 'SET_PLAN', plan: updated })
  }

  function setDay(dayIndex: number, patch: Partial<DayPlan>) {
    const days = state.plan.days.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d))
    savePlan({ ...state.plan, name: planName, days })
  }

  function addSnack(dayIndex: number) {
    const day = state.plan.days[dayIndex]
    setDay(dayIndex, { snackRecipeIds: [...day.snackRecipeIds, ''] as any })
  }

  function updateSnack(dayIndex: number, snackIndex: number, recipeId: string) {
    const day = state.plan.days[dayIndex]
    const next = day.snackRecipeIds.slice()
    next[snackIndex] = recipeId
    setDay(dayIndex, { snackRecipeIds: next.filter(Boolean) })
  }

  function removeSnack(dayIndex: number, snackIndex: number) {
    const day = state.plan.days[dayIndex]
    const next = day.snackRecipeIds.filter((_, i) => i !== snackIndex)
    setDay(dayIndex, { snackRecipeIds: next })
  }

  function newEmptyWeek() {
    const blankDay: DayPlan = { snackRecipeIds: [] }
    const next: WeekPlan = {
      id: uid(),
      name: planName || 'This Week',
      startDateISO: new Date().toISOString().slice(0, 10),
      days: Array.from({ length: 7 }, () => ({ ...blankDay })),
    }
    savePlan(next)
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Week Plan</Title>
          <Text c="dimmed" size="sm">
            Build the week first. Then validate nutrition on Dashboard.
          </Text>
        </div>
        <Badge variant="light">{state.plan.days.length} days</Badge>
      </Group>

      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <TextInput
            label="Plan name"
            value={planName}
            onChange={e => setPlanName(e.currentTarget.value)}
            placeholder="This Week"
            style={{ flex: 1, minWidth: 260 }}
          />

          <Group>
            <Button variant="default" onClick={() => savePlan({ ...state.plan, name: planName })}>
              Save name
            </Button>
            <Button variant="default" onClick={newEmptyWeek}>
              New empty week
            </Button>
          </Group>
        </Group>

        <Text c="dimmed" size="sm" mt="sm">
          UX decision: the UI enforces exactly one breakfast/lunch/dinner per day. Snacks are a list.
        </Text>
      </Card>

      {recipeOptions.length === 0 && (
        <Alert color="yellow" title="No recipes yet">
          Create recipes first (Recipes tab), then assign them here.
        </Alert>
      )}

      <Card withBorder radius="lg" p="md">
        <Text fw={650}>Days</Text>
        <Text c="dimmed" size="sm" mt={4}>
          Tip: scroll horizontally on smaller screens.
        </Text>

        <ScrollArea mt="md" type="auto" offsetScrollbars>
          <Group wrap="nowrap" align="flex-start" gap="md">
            {state.plan.days.map((day, dayIndex) => (
              <Card key={dayIndex} withBorder radius="lg" w={260} p="md">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={650}>{DAY_NAMES[dayIndex]}</Text>
                  <Badge variant="light">{day.snackRecipeIds.length} snacks</Badge>
                </Group>

                <Select
                  mt="sm"
                  label="Breakfast"
                  data={recipeOptions}
                  value={day.breakfastRecipeId ?? null}
                  onChange={v => setDay(dayIndex, { breakfastRecipeId: v || undefined })}
                  searchable
                  clearable
                  nothingFoundMessage="No recipes"
                />

                <Select
                  mt="sm"
                  label="Lunch"
                  data={recipeOptions}
                  value={day.lunchRecipeId ?? null}
                  onChange={v => setDay(dayIndex, { lunchRecipeId: v || undefined })}
                  searchable
                  clearable
                  nothingFoundMessage="No recipes"
                />

                <Select
                  mt="sm"
                  label="Dinner"
                  data={recipeOptions}
                  value={day.dinnerRecipeId ?? null}
                  onChange={v => setDay(dayIndex, { dinnerRecipeId: v || undefined })}
                  searchable
                  clearable
                  nothingFoundMessage="No recipes"
                />

                <Group justify="space-between" mt="md">
                  <Text size="sm" fw={600}>
                    Snacks
                  </Text>
                  <Button size="xs" variant="default" onClick={() => addSnack(dayIndex)}>
                    + snack
                  </Button>
                </Group>

                {day.snackRecipeIds.length === 0 ? (
                  <Text c="dimmed" size="sm" mt="xs">
                    No snacks
                  </Text>
                ) : (
                  <Stack gap="xs" mt="xs">
                    {day.snackRecipeIds.map((snackId, snackIndex) => (
                      <Group key={snackIndex} wrap="nowrap" align="flex-end">
                        <Select
                          style={{ flex: 1 }}
                          data={recipeOptions}
                          value={snackId || null}
                          onChange={v => updateSnack(dayIndex, snackIndex, v || '')}
                          searchable
                          clearable
                          nothingFoundMessage="No recipes"
                        />
                        <Button
                          size="xs"
                          variant="default"
                          color="red"
                          onClick={() => removeSnack(dayIndex, snackIndex)}
                        >
                          Remove
                        </Button>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Card>
            ))}
          </Group>
        </ScrollArea>
      </Card>

      <Card withBorder radius="lg" p="md">
        <Title order={4}>Sanity checklist</Title>
        <Stack gap={6} mt="sm">
          <Text>• Did you set a person + targets?</Text>
          <Text>• Are your recipes using mostly Foundation / SR Legacy foods?</Text>
          <Text>• Are your ingredient grams realistic (cooked vs dry matters)?</Text>
        </Stack>
        <Text c="dimmed" size="sm" mt="sm">
          Cronometer-level accuracy later needs unit support and cooked-yield adjustments. For “design a plan and validate
          coverage,” this is enough.
        </Text>
      </Card>
    </Stack>
  )
}
