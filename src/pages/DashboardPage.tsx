import React, { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Card,
  Group,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { useAppState } from '../state/AppStateContext'
import { dayTotals, weekTotals, pickMacroSnapshot } from '../state/calc'
import { clamp, formatNumber } from '../state/utils'

const SLOT_NAMES = ['Slot 1', 'Slot 2', 'Slot 3', 'Slot 4', 'Slot 5', 'Slot 6', 'Slot 7'] as const
type Mode = 'day' | 'week'

export default function DashboardPage() {
  const { state, dispatch } = useAppState()
  const person = state.people.find(p => p.id === state.selectedPersonId)

  const [mode, setMode] = useState<Mode>('week')
  const [slotIndex, setSlotIndex] = useState(0)

  const recipesById = useMemo(() => {
    const m: Record<string, any> = {}
    for (const r of state.recipes) m[r.id] = r
    return m
  }, [state.recipes])

  const totals = useMemo(() => {
    if (mode === 'week') return weekTotals(state.plan, recipesById, state.foodCache)
    return dayTotals(slotIndex, state.plan, recipesById, state.foodCache)
  }, [mode, slotIndex, state.plan, recipesById, state.foodCache])

  const macros = pickMacroSnapshot(totals)

  const targets = useMemo(() => {
    if (!person) return []
    return Object.values(person.nutrientTargets).sort((a, b) => a.name.localeCompare(b.name))
  }, [person])

  const computedRows = useMemo(() => {
    return targets.map(t => {
      const actual = totals[String(t.nutrientId)]?.amount ?? 0
      const target = mode === 'week' ? (t.weeklyOverride ?? t.daily * 7) : t.daily
      const ratio = target > 0 ? actual / target : 0
      return { ...t, actual, target, ratio }
    })
  }, [targets, totals, mode])

  const missingCount = computedRows.filter(r => r.actual < r.target).length
  const overCount = computedRows.filter(r => r.actual > r.target).length

  const personOptions = state.people.map(p => ({ value: p.id, label: p.name }))
  const slotOptions = SLOT_NAMES.map((d, i) => ({ value: String(i), label: d }))

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Review</Title>
          <Text c="dimmed" size="sm">
            Validate the bundle against targets (slot or bundle view).
          </Text>
        </div>

        {person && (
          <Group gap="xs">
            <Badge variant="light">{missingCount} under</Badge>
            <Badge variant="light">{overCount} over</Badge>
          </Group>
        )}
      </Group>

      {!person && (
        <Alert color="yellow" title="Pick a person to compare against">
          Go to <strong>Targets</strong> and select (or create) a profile.
        </Alert>
      )}

      <Card p="md">
        <Group align="flex-end" wrap="wrap" justify="space-between">
          <Select
            label="Person"
            data={personOptions}
            value={state.selectedPersonId ?? null}
            placeholder="Select…"
            onChange={v => dispatch({ type: 'SELECT_PERSON', personId: v || undefined })}
            searchable
            style={{ minWidth: 240 }}
          />

          <SegmentedControl
            value={mode}
            onChange={v => setMode(v as Mode)}
            data={[
              { label: 'Slot', value: 'day' },
              { label: 'Bundle', value: 'week' },
            ]}
          />

          {mode === 'day' && (
            <Select
              label="Slot"
              data={slotOptions}
              value={String(slotIndex)}
              onChange={v => setSlotIndex(v ? Number(v) : 0)}
              style={{ width: 160 }}
            />
          )}
        </Group>

        <Group mt="md" gap="xs" wrap="wrap">
          <Badge variant="light">Calories: {formatNumber(macros.calories ?? NaN)} kcal</Badge>
          <Badge variant="light">Protein: {formatNumber(macros.protein ?? NaN)} g</Badge>
          <Badge variant="light">Carbs: {formatNumber(macros.carbs ?? NaN)} g</Badge>
          <Badge variant="light">Fat: {formatNumber(macros.fat ?? NaN)} g</Badge>
          <Badge variant="light">Fiber: {formatNumber(macros.fiber ?? NaN)} g</Badge>
        </Group>

        {person && (
          <Text c="dimmed" size="sm" mt="sm">
            {missingCount} nutrients under target, {overCount} nutrients over target (in {mode === 'week' ? 'bundle' : 'slot'} mode).
          </Text>
        )}
      </Card>

      <Card p="md">
        <Group justify="space-between" wrap="wrap">
          <Title order={4}>Targets vs actual</Title>
          <Badge variant="light">{computedRows.length} targets</Badge>
        </Group>

        {!person ? (
          <Text c="dimmed" mt="sm">
            No person selected.
          </Text>
        ) : computedRows.length === 0 ? (
          <Text c="dimmed" mt="sm">
            No targets set yet.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={760} mt="sm">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nutrient</Table.Th>
                  <Table.Th>Actual</Table.Th>
                  <Table.Th>Target</Table.Th>
                  <Table.Th style={{ width: 260 }}>Progress</Table.Th>
                  <Table.Th>Δ</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {computedRows.map(r => {
                  const pct = clamp(r.ratio * 100, 0, 400)
                  const delta = r.actual - r.target
                  const progress = Math.min(100, pct)

                  return (
                    <Table.Tr key={r.nutrientId}>
                      <Table.Td>
                        <Text fw={600}>{r.name}</Text>
                        <Text c="dimmed" size="xs">
                          {r.unitName}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {formatNumber(r.actual)} {r.unitName}
                      </Table.Td>
                      <Table.Td>
                        {formatNumber(r.target)} {r.unitName}
                      </Table.Td>
                      <Table.Td>
                        <Progress value={progress} />
                        <Text c="dimmed" size="xs" mt={4}>
                          {formatNumber(pct, 0)}%
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text c={delta >= 0 ? 'green' : 'dimmed'} fw={600}>
                          {delta >= 0 ? '+' : ''}
                          {formatNumber(delta)} {r.unitName}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </Stack>
  )
}
