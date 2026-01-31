import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Group, NumberInput, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useAppState } from '../state/AppStateContext'
import type { NutrientTarget, PersonProfile } from '../state/types'
import { uid, formatNumber } from '../state/utils'

type NutrientOption = {
  nutrientId: number
  name: string
  unitName: string
}

function collectNutrientOptions(foodCache: Record<string, any>): NutrientOption[] {
  const map = new Map<number, NutrientOption>()
  for (const food of Object.values(foodCache)) {
    for (const n of food?.foodNutrients ?? []) {
      if (!n?.nutrientId) continue
      if (!map.has(n.nutrientId)) {
        map.set(n.nutrientId, { nutrientId: n.nutrientId, name: n.name, unitName: n.unitName })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export default function PeoplePage() {
  const { state, dispatch } = useAppState()
  const nutrientOptions = useMemo(() => collectNutrientOptions(state.foodCache), [state.foodCache])

  const selected = state.people.find(p => p.id === state.selectedPersonId)
  const [name, setName] = useState(selected?.name ?? '')

  useEffect(() => {
    setName(selected?.name ?? '')
  }, [selected?.id])

  const nutrientData = useMemo(
    () =>
      nutrientOptions.map(o => ({
        value: String(o.nutrientId),
        label: `${o.name} (${o.unitName}) — id ${o.nutrientId}`,
      })),
    [nutrientOptions],
  )

  const [selectedNutrientId, setSelectedNutrientId] = useState<string | null>(null)
  const selectedNutrient = nutrientOptions.find(o => String(o.nutrientId) === selectedNutrientId)

  const [daily, setDaily] = useState<number | ''>('')
  const [weeklyOverride, setWeeklyOverride] = useState<number | ''>('')

  function savePerson(p: PersonProfile) {
    dispatch({ type: 'UPSERT_PERSON', person: p })
  }

  function upsertTarget() {
    if (!selected) return
    if (!selectedNutrient) return
    if (typeof daily !== 'number' || !Number.isFinite(daily) || daily <= 0) return

    const weekly =
      typeof weeklyOverride === 'number' && Number.isFinite(weeklyOverride) && weeklyOverride > 0
        ? weeklyOverride
        : undefined

    const t: NutrientTarget = {
      nutrientId: selectedNutrient.nutrientId,
      name: selectedNutrient.name,
      unitName: selectedNutrient.unitName,
      daily,
      weeklyOverride: weekly,
    }

    const updated: PersonProfile = {
      ...selected,
      nutrientTargets: { ...selected.nutrientTargets, [String(t.nutrientId)]: t },
    }

    savePerson(updated)
    setDaily('')
    setWeeklyOverride('')
  }

  const personOptions = state.people.map(p => ({ value: p.id, label: p.name }))

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>People & Targets</Title>
          <Text c="dimmed" size="sm">
            Targets are explicit (no auto-RDA yet). That’s a feature, not a bug.
          </Text>
        </div>
        <Badge variant="light">{state.people.length} people</Badge>
      </Group>

      <Card withBorder radius="lg" p="md">
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

          <TextInput
            label={selected ? 'Rename' : 'Name'}
            value={name}
            onChange={e => setName(e.currentTarget.value)}
            placeholder="Scott"
            style={{ flex: 1, minWidth: 220 }}
          />

          <Group>
            <Button
              onClick={() => {
                const trimmed = name.trim()
                if (!trimmed) return
                const person: PersonProfile = selected
                  ? { ...selected, name: trimmed }
                  : {
                      id: uid(),
                      name: trimmed,
                      sex: 'male',
                      pregnancy: { enabled: false },
                      nutrientTargets: {},
                      notes: '',
                    }
                savePerson(person)
              }}
            >
              {selected ? 'Save name' : 'Add person'}
            </Button>

            <Button
              color="red"
              variant="default"
              disabled={!selected}
              onClick={() => selected && dispatch({ type: 'DELETE_PERSON', personId: selected.id })}
            >
              Delete
            </Button>
          </Group>
        </Group>

        <Text c="dimmed" size="sm" mt="sm">
          Strong opinion: targets should be transparent and editable, not a magic black box.
        </Text>
      </Card>

      {!selected && (
        <Alert color="yellow" title="No person selected">
          Create/select a person to set targets.
        </Alert>
      )}

      {selected && (
        <>
          <Card withBorder radius="lg" p="md">
            <Group justify="space-between" wrap="wrap">
              <Title order={4}>Add / update target</Title>
              <Badge variant="light">{Object.keys(selected.nutrientTargets).length} targets</Badge>
            </Group>

            {nutrientOptions.length === 0 ? (
              <Alert mt="sm" color="yellow" title="No nutrients available yet">
                Cache at least one food first (Foods tab). Then targets can be created from available nutrient IDs.
              </Alert>
            ) : (
              <Group mt="md" align="flex-end" wrap="wrap">
                <Select
                  label="Nutrient"
                  data={nutrientData}
                  value={selectedNutrientId}
                  onChange={setSelectedNutrientId}
                  searchable
                  clearable
                  nothingFoundMessage="No match"
                  style={{ flex: 1, minWidth: 320 }}
                />

                <NumberInput
                  label="Daily target"
                  value={daily}
                  onChange={setDaily}
                  min={0}
                  step={1}
                  style={{ width: 160 }}
                />

                <NumberInput
                  label="Weekly override (optional)"
                  value={weeklyOverride}
                  onChange={setWeeklyOverride}
                  min={0}
                  step={1}
                  style={{ width: 220 }}
                />

                <Button onClick={upsertTarget} disabled={!selectedNutrient || typeof daily !== 'number' || daily <= 0}>
                  Save target
                </Button>
              </Group>
            )}

            <Text c="dimmed" size="sm" mt="sm">
              Weekly defaults to daily × 7 unless you set an override.
            </Text>
          </Card>

          <Card withBorder radius="lg" p="md">
            <Group justify="space-between" wrap="wrap">
              <Title order={4}>Targets for {selected.name}</Title>
              <Badge variant="light">{Object.keys(selected.nutrientTargets).length} nutrients</Badge>
            </Group>

            {Object.keys(selected.nutrientTargets).length === 0 ? (
              <Text c="dimmed" mt="sm">
                No targets yet.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={760} mt="sm">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Nutrient</Table.Th>
                      <Table.Th>Daily</Table.Th>
                      <Table.Th>Weekly</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {Object.values(selected.nutrientTargets)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(t => (
                        <Table.Tr key={t.nutrientId}>
                          <Table.Td>
                            <Text fw={650}>{t.name}</Text>
                            <Text c="dimmed" size="xs">
                              {t.unitName} · id {t.nutrientId}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {formatNumber(t.daily)} {t.unitName}
                          </Table.Td>
                          <Table.Td>
                            {formatNumber(t.weeklyOverride ?? t.daily * 7)} {t.unitName}
                          </Table.Td>
                          <Table.Td style={{ width: 140 }}>
                            <Button
                              variant="default"
                              onClick={() => {
                                const updated: PersonProfile = {
                                  ...selected,
                                  nutrientTargets: Object.fromEntries(
                                    Object.entries(selected.nutrientTargets).filter(([k]) => k !== String(t.nutrientId)),
                                  ),
                                }
                                savePerson(updated)
                              }}
                            >
                              Remove
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Card>
        </>
      )}
    </Stack>
  )
}
