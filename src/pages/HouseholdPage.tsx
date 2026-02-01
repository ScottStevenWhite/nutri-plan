import React, { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
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
import { notifications } from '@mantine/notifications'
import { useAppState } from '../state/AppStateContext'
import type { PantryItem, ShoppingPreferences, Vendor, VendorProduct } from '../state/types'
import { formatNumber, uid } from '../state/utils'
import {
  backendDeletePantryItem,
  backendDeleteVendor,
  backendDeleteVendorProduct,
  backendSetShoppingPreferences,
  backendUpsertPantryItem,
  backendUpsertVendor,
  backendUpsertVendorProduct,
} from '../backend/api'

const VENDOR_TYPES = [
  { value: 'delivery', label: 'delivery' },
  { value: 'market', label: 'market' },
  { value: 'grocery', label: 'grocery' },
]

export default function HouseholdPage() {
  const { state, backendStatus, refresh } = useAppState()
  const h = state.household

  // -------- Preferences --------
  const [preferredPrepDay, setPreferredPrepDay] = useState(h.shoppingPreferences.preferredPrepDay ?? 'Sunday')
  const [maxRuns, setMaxRuns] = useState<number | ''>(h.shoppingPreferences.maxStoreRunsPerWeek ?? 1)
  const [prefsNotes, setPrefsNotes] = useState(h.shoppingPreferences.notes ?? '')

  // -------- Vendors --------
  const [vendorId, setVendorId] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [vendorType, setVendorType] = useState('grocery')
  const [vendorNotes, setVendorNotes] = useState('')

  // -------- Products --------
  const vendorOptions = useMemo(
    () => (h.vendors ?? []).map(v => ({ value: v.id, label: `${v.name} (${v.type})` })),
    [h.vendors],
  )

  const [productId, setProductId] = useState('')
  const [productVendorId, setProductVendorId] = useState<string>('')
  const [productName, setProductName] = useState('')
  const [gramsPerPackage, setGramsPerPackage] = useState<number | ''>('')
  const [tags, setTags] = useState('')
  const [productNotes, setProductNotes] = useState('')

  // -------- Pantry --------
  const [pantryId, setPantryId] = useState('')
  const [pantryName, setPantryName] = useState('')
  const [pantryGrams, setPantryGrams] = useState<number | ''>('')
  const [pantryFdcId, setPantryFdcId] = useState<number | ''>('')
  const [pantryVendorProductId, setPantryVendorProductId] = useState<string>('')

  async function savePrefs(vendorPriority: string[]) {
    const prefs: ShoppingPreferences = {
      vendorPriority,
      preferredPrepDay: preferredPrepDay || undefined,
      maxStoreRunsPerWeek: typeof maxRuns === 'number' && Number.isFinite(maxRuns) ? maxRuns : undefined,
      notes: prefsNotes.trim() || undefined,
    }

    try {
      await backendSetShoppingPreferences(prefs)
      await refresh()
      notifications.show({ title: 'Saved', message: 'Shopping preferences updated.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  function moveVendorPriority(id: string, dir: -1 | 1) {
    const arr = (h.shoppingPreferences.vendorPriority ?? []).slice()
    const idx = arr.indexOf(id)
    if (idx === -1) return
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= arr.length) return
    const tmp = arr[idx]
    arr[idx] = arr[nextIdx]
    arr[nextIdx] = tmp
    savePrefs(arr)
  }

  async function upsertVendor() {
    const id = vendorId.trim()
    const name = vendorName.trim()
    if (!id || !name) return

    const v: Vendor = {
      id,
      name,
      type: vendorType,
      notes: vendorNotes.trim() || undefined,
      availability: undefined,
    }

    try {
      await backendUpsertVendor(v)
      await refresh()
      setVendorId('')
      setVendorName('')
      setVendorType('grocery')
      setVendorNotes('')
      notifications.show({ title: 'Saved', message: 'Vendor upserted.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  async function removeVendor(id: string) {
    try {
      await backendDeleteVendor(id)
      await refresh()
      notifications.show({ title: 'Deleted', message: 'Vendor deleted.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  async function upsertProduct() {
    const id = productId.trim() || uid()
    const vendorId = productVendorId.trim()
    const name = productName.trim()
    if (!vendorId || !name) return

    const p: VendorProduct = {
      id,
      vendorId,
      name,
      gramsPerPackage: typeof gramsPerPackage === 'number' && Number.isFinite(gramsPerPackage) ? gramsPerPackage : undefined,
      packageSize: undefined,
      tags: tags
        .split(',')
        .map(x => x.trim())
        .filter(Boolean),
      notes: productNotes.trim() || undefined,
    }

    try {
      await backendUpsertVendorProduct(p)
      await refresh()
      setProductId('')
      setProductName('')
      setGramsPerPackage('')
      setTags('')
      setProductNotes('')
      notifications.show({ title: 'Saved', message: 'Vendor product upserted.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  async function removeProduct(id: string) {
    try {
      await backendDeleteVendorProduct(id)
      await refresh()
      notifications.show({ title: 'Deleted', message: 'Vendor product deleted.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  async function upsertPantry() {
    const id = pantryId.trim() || uid()
    const name = pantryName.trim()
    if (!name) return

    const item: PantryItem = {
      id,
      name,
      grams: typeof pantryGrams === 'number' && Number.isFinite(pantryGrams) ? pantryGrams : undefined,
      fdcId: typeof pantryFdcId === 'number' && Number.isFinite(pantryFdcId) ? pantryFdcId : undefined,
      vendorProductId: pantryVendorProductId.trim() || undefined,
      quantity: undefined,
      notes: undefined,
    }

    try {
      await backendUpsertPantryItem(item)
      await refresh()
      setPantryId('')
      setPantryName('')
      setPantryGrams('')
      setPantryFdcId('')
      setPantryVendorProductId('')
      notifications.show({ title: 'Saved', message: 'Pantry item upserted.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  async function removePantry(id: string) {
    try {
      await backendDeletePantryItem(id)
      await refresh()
      notifications.show({ title: 'Deleted', message: 'Pantry item deleted.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  const productsByVendor = useMemo(() => {
    const m: Record<string, VendorProduct[]> = {}
    for (const p of h.vendorProducts ?? []) {
      m[p.vendorId] = m[p.vendorId] ?? []
      m[p.vendorId].push(p)
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.name.localeCompare(b.name))
    return m
  }, [h.vendorProducts])

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Household</Title>
          <Text c="dimmed" size="sm">
            Backend‑persisted vendors, products, pantry, and shopping preferences.
          </Text>
        </div>

        <Group gap="xs">
          <Badge variant="light">{h.vendors.length} vendors</Badge>
          <Badge variant="light">{h.vendorProducts.length} products</Badge>
          <Badge variant="light">{h.pantry.length} pantry</Badge>
        </Group>
      </Group>

      {backendStatus !== 'online' && (
        <Alert color="yellow" title="Backend not online">
          Household editing requires the backend.
        </Alert>
      )}

      <Tabs defaultValue="prefs">
        <Tabs.List>
          <Tabs.Tab value="prefs">Preferences</Tabs.Tab>
          <Tabs.Tab value="vendors">Vendors</Tabs.Tab>
          <Tabs.Tab value="products">Products</Tabs.Tab>
          <Tabs.Tab value="pantry">Pantry</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="prefs" pt="md">
          <Card withBorder radius="lg" p="md">
            <Text fw={800}>Shopping preferences</Text>

            <Group mt="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="Preferred prep day"
                value={preferredPrepDay}
                onChange={e => setPreferredPrepDay(e.currentTarget.value)}
                placeholder="Sunday"
                style={{ width: 220 }}
              />

              <NumberInput
                label="Max store runs / week"
                value={maxRuns}
                onChange={setMaxRuns}
                min={0}
                step={1}
                style={{ width: 220 }}
              />
            </Group>

            <Textarea
              mt="sm"
              label="Notes"
              value={prefsNotes}
              onChange={e => setPrefsNotes(e.currentTarget.value)}
              placeholder="Optional…"
            />

            <Divider my="md" />

            <Text fw={700}>Vendor priority</Text>
            <Text c="dimmed" size="sm">
              Order matters for sourcing decisions.
            </Text>

            <Stack gap="xs" mt="sm">
              {(h.shoppingPreferences.vendorPriority ?? []).map((id, idx) => {
                const v = h.vendors.find(x => x.id === id)
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
                        <Button size="xs" variant="default" disabled={idx === 0} onClick={() => moveVendorPriority(id, -1)}>
                          Up
                        </Button>
                        <Button
                          size="xs"
                          variant="default"
                          disabled={idx === (h.shoppingPreferences.vendorPriority?.length ?? 1) - 1}
                          onClick={() => moveVendorPriority(id, +1)}
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

            <Button onClick={() => savePrefs(h.shoppingPreferences.vendorPriority ?? [])}>Save preferences</Button>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="vendors" pt="md">
          <Card withBorder radius="lg" p="md">
            <Text fw={800}>Add / update vendor</Text>

            <Group mt="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="ID (slug)"
                value={vendorId}
                onChange={e => setVendorId(e.currentTarget.value)}
                placeholder="azure-standard"
                style={{ width: 220 }}
              />
              <TextInput
                label="Name"
                value={vendorName}
                onChange={e => setVendorName(e.currentTarget.value)}
                placeholder="Azure Standard"
                style={{ flex: 1, minWidth: 260 }}
              />
              <Select label="Type" value={vendorType} onChange={v => setVendorType(v ?? 'grocery')} data={VENDOR_TYPES} style={{ width: 200 }} />
              <Button onClick={upsertVendor}>Save</Button>
            </Group>

            <Textarea mt="sm" label="Notes" value={vendorNotes} onChange={e => setVendorNotes(e.currentTarget.value)} />
          </Card>

          <Card withBorder radius="lg" p="md" mt="md">
            <Group justify="space-between" wrap="wrap">
              <Text fw={800}>Vendors</Text>
              <Badge variant="light">{h.vendors.length}</Badge>
            </Group>

            <Table.ScrollContainer minWidth={900} mt="sm">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>ID</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {h.vendors
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(v => (
                      <Table.Tr key={v.id}>
                        <Table.Td>
                          <Text fw={650}>{v.id}</Text>
                        </Table.Td>
                        <Table.Td>{v.name}</Table.Td>
                        <Table.Td>{v.type}</Table.Td>
                        <Table.Td style={{ width: 140 }}>
                          <Button variant="default" color="red" size="xs" onClick={() => removeVendor(v.id)}>
                            Delete
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="products" pt="md">
          <Card withBorder radius="lg" p="md">
            <Text fw={800}>Add / update vendor product</Text>

            <Group mt="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="Product ID (optional)"
                value={productId}
                onChange={e => setProductId(e.currentTarget.value)}
                placeholder="leave blank to auto-generate"
                style={{ width: 260 }}
              />

              <Select
                label="Vendor"
                value={productVendorId || null}
                onChange={v => setProductVendorId(v ?? '')}
                data={vendorOptions}
                searchable
                style={{ width: 260 }}
              />

              <TextInput
                label="Name"
                value={productName}
                onChange={e => setProductName(e.currentTarget.value)}
                placeholder="Organic rolled oats 5 lb"
                style={{ flex: 1, minWidth: 260 }}
              />

              <NumberInput
                label="Grams per package"
                value={gramsPerPackage}
                onChange={setGramsPerPackage}
                min={0}
                step={50}
                style={{ width: 200 }}
              />

              <Button onClick={upsertProduct} disabled={!productVendorId || !productName.trim()}>
                Save
              </Button>
            </Group>

            <Group mt="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="Tags (comma separated)"
                value={tags}
                onChange={e => setTags(e.currentTarget.value)}
                placeholder="staple, dry"
                style={{ flex: 1, minWidth: 260 }}
              />
              <TextInput
                label="Notes"
                value={productNotes}
                onChange={e => setProductNotes(e.currentTarget.value)}
                placeholder="Optional…"
                style={{ flex: 1, minWidth: 260 }}
              />
            </Group>
          </Card>

          <Card withBorder radius="lg" p="md" mt="md">
            <Group justify="space-between" wrap="wrap">
              <Text fw={800}>Products</Text>
              <Badge variant="light">{h.vendorProducts.length}</Badge>
            </Group>

            {h.vendors.map(v => {
              const products = productsByVendor[v.id] ?? []
              if (!products.length) return null
              return (
                <Card key={v.id} withBorder radius="lg" p="md" mt="md">
                  <Group justify="space-between" wrap="wrap">
                    <Text fw={700}>{v.name}</Text>
                    <Badge variant="light">{products.length}</Badge>
                  </Group>

                  <Table.ScrollContainer minWidth={980} mt="sm">
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Name</Table.Th>
                          <Table.Th>g/pkg</Table.Th>
                          <Table.Th>Tags</Table.Th>
                          <Table.Th />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {products.map(p => (
                          <Table.Tr key={p.id}>
                            <Table.Td>
                              <Text fw={650}>{p.name}</Text>
                              <Text c="dimmed" size="xs">
                                id {p.id}
                              </Text>
                            </Table.Td>
                            <Table.Td>{typeof p.gramsPerPackage === 'number' ? formatNumber(p.gramsPerPackage, 0) : '—'}</Table.Td>
                            <Table.Td>{(p.tags ?? []).join(', ') || '—'}</Table.Td>
                            <Table.Td style={{ width: 140 }}>
                              <Button variant="default" color="red" size="xs" onClick={() => removeProduct(p.id)}>
                                Delete
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Card>
              )
            })}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="pantry" pt="md">
          <Card withBorder radius="lg" p="md">
            <Text fw={800}>Add / update pantry item</Text>

            <Group mt="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="Item ID (optional)"
                value={pantryId}
                onChange={e => setPantryId(e.currentTarget.value)}
                placeholder="leave blank to auto-generate"
                style={{ width: 260 }}
              />

              <TextInput
                label="Name"
                value={pantryName}
                onChange={e => setPantryName(e.currentTarget.value)}
                placeholder="Rolled oats"
                style={{ flex: 1, minWidth: 260 }}
              />

              <NumberInput
                label="Grams"
                value={pantryGrams}
                onChange={setPantryGrams}
                min={0}
                step={50}
                style={{ width: 200 }}
              />

              <NumberInput
                label="fdcId (optional)"
                value={pantryFdcId}
                onChange={setPantryFdcId}
                min={0}
                step={1}
                style={{ width: 200 }}
              />

              <Button onClick={upsertPantry} disabled={!pantryName.trim()}>
                Save
              </Button>
            </Group>

            <Select
              mt="sm"
              label="Vendor product (optional)"
              value={pantryVendorProductId || null}
              onChange={v => setPantryVendorProductId(v ?? '')}
              data={(h.vendorProducts ?? [])
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(p => ({ value: p.id, label: p.name }))}
              searchable
              clearable
              nothingFoundMessage="No vendor products"
            />
          </Card>

          <Card withBorder radius="lg" p="md" mt="md">
            <Group justify="space-between" wrap="wrap">
              <Text fw={800}>Pantry</Text>
              <Badge variant="light">{h.pantry.length}</Badge>
            </Group>

            {h.pantry.length === 0 ? (
              <Text c="dimmed" mt="sm">
                Pantry is empty.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={980} mt="sm">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Grams</Table.Th>
                      <Table.Th>fdcId</Table.Th>
                      <Table.Th>Vendor product</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {h.pantry
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(p => (
                        <Table.Tr key={p.id}>
                          <Table.Td>
                            <Text fw={650}>{p.name}</Text>
                            <Text c="dimmed" size="xs">
                              id {p.id}
                            </Text>
                          </Table.Td>
                          <Table.Td>{typeof p.grams === 'number' ? formatNumber(p.grams, 0) : '—'}</Table.Td>
                          <Table.Td>{p.fdcId ?? '—'}</Table.Td>
                          <Table.Td>
                            {p.vendorProductId
                              ? h.vendorProducts.find(vp => vp.id === p.vendorProductId)?.name ?? p.vendorProductId
                              : '—'}
                          </Table.Td>
                          <Table.Td style={{ width: 140 }}>
                            <Button variant="default" color="red" size="xs" onClick={() => removePantry(p.id)}>
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
      </Tabs>

      <Text c="dimmed" size="xs">
        Sourcing rules are edited from the Grocery List “Map source…” modal (fdcId → vendorProduct).
      </Text>
    </Stack>
  )
}
