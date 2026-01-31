import React, { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'

import { useAppState } from '../state/AppStateContext'
import { todayISO, uid } from '../state/utils'
import { useLocalStorageState } from '../local/useLocalStorageState'

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
  const js = d.getDay() // 0=Sun..6=Sat
  return js === 0 ? 7 : js // Mon=1..Sun=7
}

function isDue(item: SupplementPlanItem, dateISO: string): boolean {
  if (!item.enabled) return false
  if (item.schedule === 'daily') return true
  if (item.schedule === 'monWedFri') {
    const idx = weekdayIndex(dateISO)
    return idx === 1 || idx === 3 || idx === 5
  }
  return false
}

function scheduleLabel(s: SupplementSchedule): string {
  if (s === 'daily') return 'Daily'
  if (s === 'monWedFri') return 'Mon/Wed/Fri'
  return 'As needed'
}

export default function SupplementsPage() {
  const { state } = useAppState()
  const today = todayISO()

  const [planItems, setPlanItems] = useLocalStorageState<SupplementPlanItem[]>('nutri-plan::supplementPlanItems', [])
  const [checks, setChecks] = useLocalStorageState<SupplementChecks>('nutri-plan::supplementChecks', {})

  const personOptions = useMemo(
    () => [
      { value: 'household', label: 'Household' },
      ...state.people.map(p => ({ value: p.id, label: p.name })),
    ],
    [state.people],
  )

  const [personId, setPersonId] = useState<string>('household')
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [schedule, setSchedule] = useState<SupplementSchedule>('daily')

  const dueToday = useMemo(() => {
    return planItems.filter(i => isDue(i, today))
  }, [planItems, today])

  const doneSet = useMemo(() => new Set(checks[today] ?? []), [checks, today])

  function toggleDone(itemId: string, checked: boolean) {
    setChecks(prev => {
      const existing = new Set(prev[today] ?? [])
      if (checked) existing.add(itemId)
      else existing.delete(itemId)
      return { ...prev, [today]: Array.from(existing) }
    })
  }

  function addItem() {
    const trimmed = name.trim()
    if (!trimmed) return
    const item: SupplementPlanItem = {
      id: uid(),
      personId: (personId || 'household') as any,
      name: trimmed,
      dose: dose.trim() || undefined,
      schedule,
      enabled: true,
    }
    setPlanItems(prev => [...prev, item])
    setName('')
    setDose('')
    setSchedule('daily')
  }

  const doneCount = dueToday.filter(i => doneSet.has(i.id)).length

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Supplements</Title>
          <Text c="dimmed" size="sm">
            This is not food logging. It’s a compliance checklist (v0 local-only).
          </Text>
        </div>
        <Badge variant="light">
          Today: {doneCount}/{dueToday.length} done
        </Badge>
      </Group>

      <Card withBorder radius="lg" p="md">
        <Text fw={700}>Today</Text>
        <Text c="dimmed" size="sm" mt={4}>
          Date: {today}
        </Text>

        <Divider my="md" />

        {dueToday.length === 0 ? (
          <Text c="dimmed">No scheduled items today.</Text>
        ) : (
          <Stack gap="sm">
            {dueToday.map(i => (
              <Card key={i.id} withBorder radius="lg" p="md">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} lineClamp={1}>
                      {i.name}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {scheduleLabel(i.schedule)}
                      {i.dose ? ` · ${i.dose}` : ''}
                    </Text>
                  </div>

                  <Checkbox
                    checked={doneSet.has(i.id)}
                    onChange={e => toggleDone(i.id, e.currentTarget.checked)}
                    aria-label="Done"
                  />
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        <Divider my="md" />

        <Button variant="default" color="red" onClick={() => setChecks(prev => ({ ...prev, [today]: [] }))}>
          Reset today
        </Button>
      </Card>

      <Card withBorder radius="lg" p="md">
        <Text fw={700}>Add item</Text>

        <Group mt="sm" align="flex-end" wrap="wrap">
          <Select
            label="Person"
            data={personOptions}
            value={personId}
            onChange={v => setPersonId(v ?? 'household')}
            style={{ minWidth: 220 }}
          />

          <TextInput
            label="Name"
            value={name}
            onChange={e => setName(e.currentTarget.value)}
            placeholder="Creatine"
            style={{ flex: 1, minWidth: 220 }}
          />

          <TextInput
            label="Dose (optional)"
            value={dose}
            onChange={e => setDose(e.currentTarget.value)}
            placeholder="5g"
            style={{ width: 160 }}
          />

          <Select
            label="Schedule"
            data={[
              { value: 'daily', label: 'Daily' },
              { value: 'monWedFri', label: 'Mon/Wed/Fri' },
              { value: 'asNeeded', label: 'As needed' },
            ]}
            value={schedule}
            onChange={v => setSchedule((v as SupplementSchedule) ?? 'daily')}
            style={{ width: 180 }}
          />

          <Button onClick={addItem}>Add</Button>
        </Group>

        <Text c="dimmed" size="sm" mt="sm">
          Later: supplement products + nutrients per dose + backend contribution to totals.
        </Text>
      </Card>

      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" wrap="wrap">
          <Text fw={700}>All plan items</Text>
          <Badge variant="light">{planItems.length} items</Badge>
        </Group>

        {planItems.length === 0 ? (
          <Text c="dimmed" mt="sm">
            No items yet.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={900} mt="sm">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Enabled</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Person</Table.Th>
                  <Table.Th>Schedule</Table.Th>
                  <Table.Th>Dose</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {planItems.map(i => {
                  const who =
                    i.personId === 'household'
                      ? 'Household'
                      : (state.people.find(p => p.id === i.personId)?.name ?? 'Unknown')
                  return (
                    <Table.Tr key={i.id}>
                      <Table.Td>
                        <Checkbox
                          checked={i.enabled}
                          onChange={e =>
                            setPlanItems(prev => prev.map(x => (x.id === i.id ? { ...x, enabled: e.currentTarget.checked } : x)))
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text fw={650}>{i.name}</Text>
                      </Table.Td>
                      <Table.Td>{who}</Table.Td>
                      <Table.Td>{scheduleLabel(i.schedule)}</Table.Td>
                      <Table.Td>{i.dose ?? '—'}</Table.Td>
                      <Table.Td style={{ width: 120 }}>
                        <Button
                          variant="default"
                          color="red"
                          size="xs"
                          onClick={() => setPlanItems(prev => prev.filter(x => x.id !== i.id))}
                        >
                          Delete
                        </Button>
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
