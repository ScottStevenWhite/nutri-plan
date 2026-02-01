import React, { useMemo, useState } from 'react'
import { Badge, Card, Group, Modal, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useAppState } from '../state/AppStateContext'
import type { KitchenEquipmentItem } from '../state/types'

function pretty(v: any): string {
  try {
    return JSON.stringify(v ?? null, null, 2)
  } catch {
    return String(v)
  }
}

function matchesItem(i: KitchenEquipmentItem, q: string): boolean {
  if (!q) return true
  const hay = [
    i.name,
    i.officialName ?? '',
    i.manufacturer ?? '',
    i.model ?? '',
    i.serialNumber ?? '',
    i.kitchenLocation ?? '',
    i.category ?? '',
    i.subtype ?? '',
    ...(i.categoryPath ?? []),
    ...(i.capabilities ?? []),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export default function KitchenEquipmentPanel() {
  const { state } = useAppState()
  const equipment = state.household.equipment

  const [q, setQ] = useState('')
  const [opened, { open, close }] = useDisclosure(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const items = equipment.items ?? []
  const active = items.find(x => x.id === activeId)

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return items
      .filter(it => matchesItem(it, qq))
      .slice()
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [items, q])

  return (
    <Stack gap="md">
      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Title order={4}>Kitchen equipment</Title>
            <Text c="dimmed" size="sm">
              schema {equipment.schemaVersion} · generated {equipment.generatedAtLocalDate}
            </Text>
            <Text c="dimmed" size="sm">
              defaults: {equipment.defaults.unitSystem}, {equipment.defaults.tempUnit}
              {equipment.defaults.kitchenLocation ? ` · location: ${equipment.defaults.kitchenLocation}` : ''}
            </Text>
          </div>

          <Badge variant="light">{items.length} items</Badge>
        </Group>

        <TextInput
          mt="md"
          label="Search"
          value={q}
          onChange={e => setQ(e.currentTarget.value)}
          placeholder="air fryer, Vitamix, cast iron, blender…"
        />
      </Card>

      <Modal opened={opened} onClose={close} title="Equipment details" centered size="lg">
        {!active ? (
          <Text c="dimmed">No item selected.</Text>
        ) : (
          <Stack gap="xs">
            <Text fw={800}>{active.name}</Text>
            <Text c="dimmed" size="sm">
              id {active.id}
              {active.parentId ? ` · parent ${active.parentId}` : ''}
            </Text>

            <Text size="sm">
              <strong>Category:</strong> {active.category}
              {active.subtype ? ` / ${active.subtype}` : ''}
            </Text>

            <Text size="sm">
              <strong>Category path:</strong> {(active.categoryPath ?? []).join(' > ') || '—'}
            </Text>

            <Text size="sm">
              <strong>Location:</strong> {active.kitchenLocation ?? equipment.defaults.kitchenLocation ?? '—'}
            </Text>

            <Text size="sm">
              <strong>Capabilities:</strong> {(active.capabilities ?? []).join(', ') || '—'}
            </Text>

            <Text size="sm">
              <strong>Care:</strong>{' '}
              {active.care
                ? `${active.care.dishwasherSafe}; needs: ${(active.care.cleaningNeeds ?? []).join(', ') || '—'}`
                : '—'}
            </Text>

            <Text size="sm">
              <strong>Specs:</strong>
            </Text>
            <pre style={{ margin: 0, maxHeight: 220, overflow: 'auto' }}>{pretty(active.specs)}</pre>

            <Text size="sm">
              <strong>Safety:</strong>
            </Text>
            <pre style={{ margin: 0, maxHeight: 220, overflow: 'auto' }}>{pretty(active.safety)}</pre>

            {active.notes ? (
              <>
                <Text size="sm">
                  <strong>Notes:</strong>
                </Text>
                <Text size="sm">{active.notes}</Text>
              </>
            ) : null}
          </Stack>
        )}
      </Modal>

      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" wrap="wrap">
          <Text fw={800}>Items</Text>
          <Badge variant="light">{filtered.length} shown</Badge>
        </Group>

        <Table.ScrollContainer minWidth={980} mt="sm">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Category path</Table.Th>
                <Table.Th>Location</Table.Th>
                <Table.Th>Capabilities</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map(it => (
                <Table.Tr
                  key={it.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setActiveId(it.id)
                    open()
                  }}
                >
                  <Table.Td>
                    <Text fw={650}>{it.name}</Text>
                    <Text c="dimmed" size="xs">
                      {it.manufacturer ? `${it.manufacturer} ` : ''}
                      {it.model ?? ''}
                    </Text>
                  </Table.Td>
                  <Table.Td>{(it.categoryPath ?? []).join(' > ') || '—'}</Table.Td>
                  <Table.Td>{it.kitchenLocation ?? equipment.defaults.kitchenLocation ?? '—'}</Table.Td>
                  <Table.Td>{(it.capabilities ?? []).slice(0, 4).join(', ') || '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <Text c="dimmed" size="xs" mt="sm">
          Editing/import isn’t supported yet. This is intentionally read-only for now.
        </Text>
      </Card>
    </Stack>
  )
}
