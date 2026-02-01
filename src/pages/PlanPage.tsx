import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Group, ScrollArea, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { useAppState } from '../state/AppStateContext'
import type { DayPlan, WeekPlan } from '../state/types'
import { todayISO, uid } from '../state/utils'

const SLOT_NAMES = ['Slot 1', 'Slot 2', 'Slot 3', 'Slot 4', 'Slot 5', 'Slot 6', 'Slot 7'] as const

export default function PlanPage() {
  const { state, dispatch } = useAppState()
  const [bundleName, setBundleName] = useState(state.plan.name)
  const [pendingSnacksBySlot, setPendingSnacksBySlot] = useState<Record<number, number>>({})

  // keep local input in sync when plan changes from hydration/reset
  useEffect(() => {
    setBundleName(state.plan.name)
    setPendingSnacksBySlot({})
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

  function setSlot(slotIndex: number, patch: Partial<DayPlan>) {
    const days = state.plan.days.map((d, i) => (i === slotIndex ? { ...d, ...patch } : d))
    savePlan({ ...state.plan, name: bundleName, days })
  }

  function addSnackSlot(slotIndex: number) {
    setPendingSnacksBySlot(prev => ({
      ...prev,
      [slotIndex]: (prev[slotIndex] ?? 0) + 1,
    }))
  }

  function removePendingSnackSlot(slotIndex: number) {
    setPendingSnacksBySlot(prev => {
      const cur = prev[slotIndex] ?? 0
      const nextCount = Math.max(0, cur - 1)
      const next = { ...prev, [slotIndex]: nextCount }
      if (nextCount === 0) delete next[slotIndex]
      return next
    })
  }

  function commitNewSnack(slotIndex: number, recipeId: string) {
    const id = recipeId.trim()
    if (!id) return
    const day = state.plan.days[slotIndex]
    setSlot(slotIndex, { snackRecipeIds: [...day.snackRecipeIds, id] })
    removePendingSnackSlot(slotIndex)
  }

  function updateSnack(slotIndex: number, snackIndex: number, recipeId: string) {
    const day = state.plan.days[slotIndex]
    const next = day.snackRecipeIds.slice()
    next[snackIndex] = recipeId
    setSlot(slotIndex, { snackRecipeIds: next.filter(Boolean) })
  }

  function removeSnack(slotIndex: number, snackIndex: number) {
    const day = state.plan.days[slotIndex]
    const next = day.snackRecipeIds.filter((_, i) => i !== snackIndex)
    setSlot(slotIndex, { snackRecipeIds: next })
  }

  function newEmptyBundle() {
    const blankDay: DayPlan = { snackRecipeIds: [] }
    const next: WeekPlan = {
      id: uid(),
      name: bundleName || 'Slot Bundle',
      startDateISO: todayISO(),
      days: Array.from({ length: 7 }, () => ({ ...blankDay })),
    }
    savePlan(next)
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Edit Slots</Title>
          <Text c="dimmed" size="sm">
            Surgical overrides after generation. These are slots, not a calendar week.
          </Text>
        </div>
        <Badge variant="light">{state.plan.days.length} slots</Badge>
      </Group>

      <Card p="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <TextInput
            label="Bundle name"
            value={bundleName}
            onChange={e => setBundleName(e.currentTarget.value)}
            placeholder="Slot Bundle"
            style={{ flex: 1, minWidth: 260 }}
          />

          <Group>
            <Button variant="default" onClick={() => savePlan({ ...state.plan, name: bundleName })}>
              Save name
            </Button>
            <Button variant="default" onClick={newEmptyBundle}>
              New empty bundle
            </Button>
          </Group>
        </Group>

        <Text c="dimmed" size="sm" mt="sm">
          UX decision: still enforces max one breakfast/lunch/dinner per slot. Snacks are a list.
        </Text>
      </Card>

      {recipeOptions.length === 0 && (
        <Alert color="yellow" title="No recipes yet">
          Create recipes first (Recipes tab), then assign them here.
        </Alert>
      )}

      <Card p="md">
        <Text fw={650}>Slots</Text>
        <Text c="dimmed" size="sm" mt={4}>
          Tip: scroll horizontally on smaller screens.
        </Text>

        <ScrollArea mt="md" type="auto" offsetScrollbars>
          <Group wrap="nowrap" align="flex-start" gap="md">
            {state.plan.days.map((day, slotIndex) => (
              <Card key={slotIndex} w={280} p="md">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={650}>{SLOT_NAMES[slotIndex]}</Text>
                  <Badge variant="light">{day.snackRecipeIds.length} snacks</Badge>
                </Group>

                <Select
                  mt="sm"
                  label="Breakfast"
                  data={recipeOptions}
                  value={day.breakfastRecipeId ?? null}
                  onChange={v => setSlot(slotIndex, { breakfastRecipeId: v || undefined })}
                  searchable
                  clearable
                  nothingFoundMessage="No recipes"
                />

                <Select
                  mt="sm"
                  label="Lunch"
                  data={recipeOptions}
                  value={day.lunchRecipeId ?? null}
                  onChange={v => setSlot(slotIndex, { lunchRecipeId: v || undefined })}
                  searchable
                  clearable
                  nothingFoundMessage="No recipes"
                />

                <Select
                  mt="sm"
                  label="Dinner"
                  data={recipeOptions}
                  value={day.dinnerRecipeId ?? null}
                  onChange={v => setSlot(slotIndex, { dinnerRecipeId: v || undefined })}
                  searchable
                  clearable
                  nothingFoundMessage="No recipes"
                />

                <Group justify="space-between" mt="md">
                  <Text size="sm" fw={600}>
                    Snacks
                  </Text>
                  <Button size="xs" variant="default" onClick={() => addSnackSlot(slotIndex)}>
                    + snack
                  </Button>
                </Group>

                {day.snackRecipeIds.length === 0 && !(pendingSnacksBySlot[slotIndex] ?? 0) ? (
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
                          onChange={v => updateSnack(slotIndex, snackIndex, v || '')}
                          searchable
                          clearable
                          nothingFoundMessage="No recipes"
                        />
                        <Button
                          size="xs"
                          variant="default"
                          color="red"
                          onClick={() => removeSnack(slotIndex, snackIndex)}
                        >
                          Remove
                        </Button>
                      </Group>
                    ))}

                    {Array.from({ length: pendingSnacksBySlot[slotIndex] ?? 0 }).map((_, i) => (
                      <Group key={`pending-${i}`} wrap="nowrap" align="flex-end">
                        <Select
                          style={{ flex: 1 }}
                          data={recipeOptions}
                          value={null}
                          onChange={v => commitNewSnack(slotIndex, v || '')}
                          searchable
                          clearable
                          nothingFoundMessage="No recipes"
                          placeholder="Pick a snack…"
                        />
                        <Button
                          size="xs"
                          variant="default"
                          color="red"
                          onClick={() => removePendingSnackSlot(slotIndex)}
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
    </Stack>
  )
}
