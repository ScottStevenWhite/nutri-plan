import React, { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'

import { useHousehold } from '../local/household'
import { uid } from '../state/utils'

const CAPABILITIES = [
  { value: 'blend', label: 'Blend' },
  { value: 'bake', label: 'Bake' },
  { value: 'pressureCook', label: 'Pressure cook' },
  { value: 'airFry', label: 'Air fry' },
  { value: 'stovetop', label: 'Stovetop' },
  { value: 'grill', label: 'Grill' },
  { value: 'microwave', label: 'Microwave' },
  { value: 'slowCook', label: 'Slow cook' },
]

const PREP_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => ({
  value: d,
  label: d,
}))

export default function HouseholdPage() {
  const [household, setHousehold] = useHousehold()

  // Equipment form
  const [eqName, setEqName] = useState('')
  const [eqCaps, setEqCaps] = useState<string[]>([])
  const [eqNotes, setEqNotes] = useState('')

  // Preferences
  const [maxRuns, setMaxRuns] = useState<number>(household.shoppingPreferences.maxStoreRunsPerWeek)
  const [prepDay, setPrepDay] = useState<string>(household.shoppingPreferences.prepDay)

  // Pantry form
  const [pantryName, setPantryName] = useState('')
  const [pantryFdcId, setPantryFdcId] = useState<number | ''>('')
  const [pantryQty, setPantryQty] = useState<number | ''>('')
  const [pantryUnit, setPantryUnit] = useState('g')

  const vendorOptions = useMemo(
    () => household.vendors.map(v => ({ value: v.id, label: `${v.name} (${v.type})` })),
    [household.vendors],
  )

  function savePreferences() {
    setHousehold(prev => ({
      ...prev,
      shoppingPreferences: {
        ...prev.shoppingPreferences,
        maxStoreRunsPerWeek: Number.isFinite(maxRuns) && maxRuns > 0 ? maxRuns : prev.shoppingPreferences.maxStoreRunsPerWeek,
        prepDay: (prepDay as any) || prev.shoppingPreferences.prepDay,
      },
    }))
  }

  function moveVendor(id: string, dir: -1 | 1) {
    setHousehold(prev => {
      const arr = prev.shoppingPreferences.vendorPriority.slice()
      const idx = arr.indexOf(id as any)
      if (idx === -1) return prev
      const nextIdx = idx + dir
      if (nextIdx < 0 || nextIdx >= arr.length) return prev
      const tmp = arr[idx]
      arr[idx] = arr[nextIdx]
      arr[nextIdx] = tmp
      return { ...prev, shoppingPreferences: { ...prev.shoppingPreferences, vendorPriority: arr as any } }
    })
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Household</Title>
          <Text c="dimmed" size="sm">
            Shared resources: equipment, vendors, pantry, and (eventually) sourcing rules.
          </Text>
        </div>
        <Badge variant="light">Local-only v0</Badge>
      </Group>

      <Tabs defaultValue="equipment">
        <Tabs.List>
          <Tabs.Tab value="equipment">Equipment</Tabs.Tab>
          <Tabs.Tab value="vendors">Vendors & Preferences</Tabs.Tab>
          <Tabs.Tab value="pantry">Pantry</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="equipment" pt="md">
          <Card withBorder radius="lg" p="md">
            <Text fw={700}>Add equipment</Text>

            <Group mt="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="Name"
                value={eqName}
                onChange={e => setEqName(e.currentTarget.value)}
                placeholder="Air fryer"
                style={{ flex: 1, minWidth: 220 }}
              />

              <MultiSelect
                label="Capabilities"
                data={CAPABILITIES}
                value={eqCaps}
                onChange={setEqCaps}
                placeholder="Select…"
                searchable
                style={{ flex: 1, minWidth: 260 }}
              />

              <Button
                onClick={() => {
                  const trimmed = eqName.trim()
                  if (!trimmed) return
                  setHousehold(prev => ({
                    ...prev,
                    equipment: [
                      ...prev.equipment,
                      {
                        id: uid(),
                        name: trimmed,
                        capabilities: eqCaps as any,
                        notes: eqNotes.trim() || undefined,
                      },
                    ],
                  }))
                  setEqName('')
                  setEqCaps([])
                  setEqNotes('')
                }}
              >
                Add
              </Button>
            </Group>

            <Textarea
              mt="sm"
              label="Notes (optional)"
              value={eqNotes}
              onChange={e => setEqNotes(e.currentTarget.value)}
              placeholder="Anything relevant…"
            />
          </Card>

          <Card withBorder radius="lg" p="md" mt="md">
            <Group justify="space-between" wrap="wrap">
              <Text fw={700}>Equipment</Text>
              <Badge variant="light">{household.equipment.length}</Badge>
            </Group>

            {household.equipment.length === 0 ? (
              <Text c="dimmed" mt="sm">
                No equipment yet.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={900} mt="sm">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Capabilities</Table.Th>
                      <Table.Th>Notes</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {household.equipment.map(eq => (
                      <Table.Tr key={eq.id}>
                        <Table.Td>
                          <Text fw={650}>{eq.name}</Text>
                        </Table.Td>
                        <Table.Td>{(eq.capabilities ?? []).join(', ') || '—'}</Table.Td>
                        <Table.Td>{eq.notes ?? '—'}</Table.Td>
                        <Table.Td style={{ width: 120 }}>
                          <Button
                            size="xs"
                            variant="default"
                            color="red"
                            onClick={() =>
                              setHousehold(prev => ({ ...prev, equipment: prev.equipment.filter(x => x.id !== eq.id) }))
                            }
                          >
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
        </Tabs.Panel>

        <Tabs.Panel value="vendors" pt="md">
          <Card withBorder radius="lg" p="md">
            <Text fw={700}>Shopping preferences</Text>

            <Group mt="sm" align="flex-end" wrap="wrap">
              <NumberInput
                label="Max store runs/week"
                value={maxRuns}
                onChange={v => setMaxRuns(typeof v === 'number' ? v : household.shoppingPreferences.maxStoreRunsPerWeek)}
                min={1}
                step={1}
                style={{ width: 220 }}
              />

              <Select
                label="Prep day"
                data={PREP_DAYS}
                value={prepDay}
                onChange={v => setPrepDay(v ?? 'Sunday')}
                style={{ width: 220 }}
              />

              <Button onClick={savePreferences}>Save</Button>
            </Group>

            <Text c="dimmed" size="sm" mt="sm">
              Vendor ordering matters later for sourcing.
            </Text>
          </Card>

          <Card withBorder radius="lg" p="md" mt="md">
            <Group justify="space-between" wrap="wrap">
              <Text fw={700}>Vendor priority</Text>
              <Badge variant="light">{household.shoppingPreferences.vendorPriority.length}</Badge>
            </Group>

            <Stack gap="xs" mt="sm">
              {household.shoppingPreferences.vendorPriority.map((id, idx) => {
                const v = household.vendors.find(x => x.id === id)
                return (
                  <Card key={id} withBorder radius="lg" p="md">
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Text fw={650} lineClamp={1}>
                          {v?.name ?? id}
                        </Text>
                        <Text c="dimmed" size="sm">
                          {v?.type ?? '—'} · priority {idx + 1}
                        </Text>
                      </div>

                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="default"
                          disabled={idx === 0}
                          onClick={() => moveVendor(id, -1)}
                        >
                          Up
                        </Button>
                        <Button
                          size="xs"
                          variant="default"
                          disabled={idx === household.shoppingPreferences.vendorPriority.length - 1}
                          onClick={() => moveVendor(id, +1)}
                        >
                          Down
                        </Button>
                      </Group>
                    </Group>
                  </Card>
                )
              })}
            </Stack>

            <Divider my="md" />

            <Text c="dimmed" size="sm">
              Later: availability rules (market days/season), Azure cutoff day, etc.
            </Text>
          </Card>

          <Card withBorder radius="lg" p="md" mt="md">
            <Group justify="space-between" wrap="wrap">
              <Text fw={700}>Vendors</Text>
              <Badge variant="light">{household.vendors.length}</Badge>
            </Group>

            <Table.ScrollContainer minWidth={900} mt="sm">
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>ID</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Type</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {household.vendors.map(v => (
                    <Table.Tr key={v.id}>
                      <Table.Td>
                        <Text fw={650}>{v.id}</Text>
                      </Table.Td>
                      <Table.Td>{v.name}</Table.Td>
                      <Table.Td>{v.type}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="pantry" pt="md">
          <Card withBorder radius="lg" p="md">
            <Text fw={700}>Add pantry item</Text>

            <Group mt="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="Name"
                value={pantryName}
                onChange={e => setPantryName(e.currentTarget.value)}
                placeholder="Rolled oats"
                style={{ flex: 1, minWidth: 220 }}
              />

              <NumberInput
                label="fdcId (optional)"
                value={pantryFdcId}
                onChange={v => setPantryFdcId(typeof v === 'number' ? v : '')}
                min={0}
                step={1}
                style={{ width: 180 }}
              />

              <NumberInput
                label="Quantity"
                value={pantryQty}
                onChange={v => setPantryQty(typeof v === 'number' ? v : '')}
                min={0}
                step={50}
                style={{ width: 160 }}
              />

              <TextInput
                label="Unit"
                value={pantryUnit}
                onChange={e => setPantryUnit(e.currentTarget.value)}
                placeholder="g"
                style={{ width: 120 }}
              />

              <Button
                onClick={() => {
                  const trimmed = pantryName.trim()
                  if (!trimmed) return
                  setHousehold(prev => ({
                    ...prev,
                    pantry: [
                      ...prev.pantry,
                      {
                        id: uid(),
                        name: trimmed,
                        fdcId: typeof pantryFdcId === 'number' && pantryFdcId > 0 ? pantryFdcId : undefined,
                        quantity: typeof pantryQty === 'number' && pantryQty > 0 ? pantryQty : undefined,
                        unit: pantryUnit.trim() || undefined,
                      },
                    ],
                  }))
                  setPantryName('')
                  setPantryFdcId('')
                  setPantryQty('')
                  setPantryUnit('g')
                }}
              >
                Add
              </Button>
            </Group>

            <Text c="dimmed" size="sm" mt="sm">
              Pantry subtraction in Grocery List only works with <code>fdcId</code> + unit <code>g</code>.
            </Text>
          </Card>

          <Card withBorder radius="lg" p="md" mt="md">
            <Group justify="space-between" wrap="wrap">
              <Text fw={700}>Pantry</Text>
              <Badge variant="light">{household.pantry.length}</Badge>
            </Group>

            {household.pantry.length === 0 ? (
              <Text c="dimmed" mt="sm">
                No pantry items yet.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={900} mt="sm">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>fdcId</Table.Th>
                      <Table.Th>Qty</Table.Th>
                      <Table.Th>Unit</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {household.pantry.map(p => (
                      <Table.Tr key={p.id}>
                        <Table.Td>
                          <Text fw={650}>{p.name}</Text>
                        </Table.Td>
                        <Table.Td>{p.fdcId ?? '—'}</Table.Td>
                        <Table.Td>{p.quantity ?? '—'}</Table.Td>
                        <Table.Td>{p.unit ?? '—'}</Table.Td>
                        <Table.Td style={{ width: 120 }}>
                          <Button
                            size="xs"
                            variant="default"
                            color="red"
                            onClick={() => setHousehold(prev => ({ ...prev, pantry: prev.pantry.filter(x => x.id !== p.id) }))}
                          >
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

          <Card withBorder radius="lg" p="md" mt="md">
            <Text fw={700}>Sourcing rules</Text>
            <Text c="dimmed" size="sm" mt={4}>
              For v0, sourcing rules are set from the Grocery List “Choose source” wizard.
            </Text>

            <Divider my="md" />

            <Table.ScrollContainer minWidth={900}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>fdcId</Table.Th>
                    <Table.Th>Ingredient</Table.Th>
                    <Table.Th>Vendor</Table.Th>
                    <Table.Th>Product</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {household.sourcingRules.map(r => (
                    <Table.Tr key={r.id}>
                      <Table.Td>{r.fdcId}</Table.Td>
                      <Table.Td>{r.ingredientName}</Table.Td>
                      <Table.Td>
                        {vendorOptions.find(v => v.value === r.vendorId)?.label ?? r.vendorId ?? '—'}
                      </Table.Td>
                      <Table.Td>{r.productName ?? '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Text c="dimmed" size="xs">
        This Household module is intentionally local-only until backend schema lands. Don’t confuse “works on my machine” with “correct model.”
      </Text>
    </Stack>
  )
}
