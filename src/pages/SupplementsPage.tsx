import React, { useMemo, useState } from 'react'
import { Badge, Button, Card, Group, NumberInput, Select, Stack, Table, Text, TextInput, Textarea, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { useAppState } from '../state/AppStateContext'
import type { Supplement } from '../state/types'
import { uid } from '../state/utils'
import { backendDeleteSupplement, backendUpsertSupplement } from '../backend/api'

const CATEGORY_OPTIONS = [
  { value: 'supplement', label: 'supplement' },
  { value: 'vitamin', label: 'vitamin' },
  { value: 'medication', label: 'medication' },
  { value: 'other', label: 'other' },
]

export default function SupplementsPage() {
  const { state, dispatch, refresh } = useAppState()

  const personOptions = state.people.map(p => ({ value: p.id, label: p.name }))
  const person = state.people.find(p => p.id === state.selectedPersonId)

  const [suppId, setSuppId] = useState<string>('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('supplement')
  const [dose, setDose] = useState<number | ''>('')
  const [unit, setUnit] = useState('')
  const [schedule, setSchedule] = useState('')
  const [notes, setNotes] = useState('')

  async function save() {
    if (!person) return
    const trimmed = name.trim()
    if (!trimmed) return

    const s: Supplement = {
      id: suppId || uid(),
      name: trimmed,
      category,
      dose: typeof dose === 'number' && Number.isFinite(dose) ? dose : undefined,
      unit: unit.trim() || undefined,
      schedule: schedule.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    try {
      await backendUpsertSupplement(person.id, s)
      await refresh()
      setSuppId('')
      setName('')
      setCategory('supplement')
      setDose('')
      setUnit('')
      setSchedule('')
      setNotes('')
      notifications.show({ title: 'Saved', message: 'Supplement upserted.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  async function remove(supplementId: string) {
    if (!person) return
    try {
      await backendDeleteSupplement(person.id, supplementId)
      await refresh()
      notifications.show({ title: 'Deleted', message: 'Supplement removed.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  const supplements = useMemo(() => (person?.supplements ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [person])

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Supplements & Meds</Title>
          <Text c="dimmed" size="sm">
            Stored on the backend per person. (Compliance checklist comes later.)
          </Text>
        </div>
        <Badge variant="light">{supplements.length} items</Badge>
      </Group>

      <Card withBorder radius="lg" p="md">
        <Select
          label="Person"
          data={personOptions}
          value={state.selectedPersonId ?? null}
          placeholder="Select…"
          onChange={v => dispatch({ type: 'SELECT_PERSON', personId: v || undefined })}
          searchable
          style={{ minWidth: 240 }}
        />
      </Card>

      {!person ? (
        <Text c="dimmed">Pick a person.</Text>
      ) : (
        <>
          <Card withBorder radius="lg" p="md">
            <Group justify="space-between" wrap="wrap">
              <Text fw={800}>Add / update</Text>
              <Badge variant="light">writes to backend</Badge>
            </Group>

            <Group mt="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="Name"
                value={name}
                onChange={e => setName(e.currentTarget.value)}
                placeholder="Creatine"
                style={{ flex: 1, minWidth: 220 }}
              />

              <Select
                label="Category"
                value={category}
                onChange={v => setCategory(v ?? 'supplement')}
                data={CATEGORY_OPTIONS}
                style={{ width: 180 }}
              />

              <NumberInput label="Dose" value={dose} onChange={setDose} min={0} step={1} style={{ width: 140 }} />
              <TextInput label="Unit" value={unit} onChange={e => setUnit(e.currentTarget.value)} placeholder="g" style={{ width: 120 }} />
              <TextInput
                label="Schedule"
                value={schedule}
                onChange={e => setSchedule(e.currentTarget.value)}
                placeholder="daily / mon-wed-fri"
                style={{ width: 220 }}
              />

              <Button onClick={save} disabled={!name.trim()}>
                Save
              </Button>
            </Group>

            <Textarea mt="sm" label="Notes" value={notes} onChange={e => setNotes(e.currentTarget.value)} />
          </Card>

          <Card withBorder radius="lg" p="md">
            <Group justify="space-between" wrap="wrap">
              <Text fw={800}>Current list</Text>
              <Badge variant="light">{supplements.length}</Badge>
            </Group>

            {supplements.length === 0 ? (
              <Text c="dimmed" mt="sm">
                No supplements yet.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={980} mt="sm">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Dose</Table.Th>
                      <Table.Th>Schedule</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {supplements.map(s => (
                      <Table.Tr key={s.id}>
                        <Table.Td>
                          <Text fw={650}>{s.name}</Text>
                          <Text c="dimmed" size="xs">
                            id {s.id}
                          </Text>
                        </Table.Td>
                        <Table.Td>{String(s.category ?? '—')}</Table.Td>
                        <Table.Td>
                          {typeof s.dose === 'number' ? `${s.dose} ${s.unit ?? ''}`.trim() : '—'}
                        </Table.Td>
                        <Table.Td>{s.schedule ?? '—'}</Table.Td>
                        <Table.Td style={{ width: 140 }}>
                          <Button variant="default" color="red" size="xs" onClick={() => remove(s.id)}>
                            Delete
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
