import React, { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'

import type { AppPage } from '../routes'
import { useAppState } from '../state/AppStateContext'
import { formatNumber } from '../state/utils'
import { computeIngredientDemand } from '../derive/plan'
import { findSourcingRule, upsertSourcingRule, useHousehold, vendorLabel } from '../local/household'
import { useLocalStorageState } from '../local/useLocalStorageState';

type Props = {
  navigate: (page: AppPage) => void
}

type GroceryStatus = 'need' | 'have' | 'bought' | 'skip'
type GroceryStatusMap = Record<string, GroceryStatus>

function statusColor(s: GroceryStatus): string {
  switch (s) {
    case 'need':
      return 'yellow'
    case 'have':
      return 'gray'
    case 'bought':
      return 'green'
    case 'skip':
      return 'red'
    default:
      return 'gray'
  }
}

function nextStatus(s: GroceryStatus): GroceryStatus {
  if (s === 'need') return 'have'
  if (s === 'have') return 'bought'
  if (s === 'bought') return 'skip'
  return 'need'
}

function defaultStatusFor(neededGrams: number): GroceryStatus {
  return neededGrams > 0 ? 'need' : 'have'
}

export default function GroceryListPage({ navigate }: Props) {
  const { state } = useAppState()
  const [household, setHousehold] = useHousehold()

  const recipesById = useMemo(() => {
    const m: Record<string, any> = {}
    for (const r of state.recipes) m[r.id] = r
    return m
  }, [state.recipes])

  const ingredientDemand = useMemo(() => computeIngredientDemand(state.plan, recipesById), [state.plan, recipesById])

  const [statusMap, setStatusMap] = useLocalStorageState<GroceryStatusMap>(
    `nutri-plan::groceryStatus::${state.plan.id}`,
    {},
  )

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | GroceryStatus>('all')

  const isMobile = useMediaQuery('(max-width: 48em)')

  // Sourcing wizard modal state
  const [opened, { open, close }] = useDisclosure(false)
  const [activeFdcId, setActiveFdcId] = useState<number | null>(null)
  const activeLine = activeFdcId != null ? ingredientDemand[String(activeFdcId)] : undefined
  const activeRule = activeFdcId != null ? findSourcingRule(household, activeFdcId) : undefined

  const [vendorId, setVendorId] = useState<string>('')
  const [productName, setProductName] = useState('')

  function openWizard(fdcId: number) {
    const line = ingredientDemand[String(fdcId)]
    if (!line) return
    const rule = findSourcingRule(household, fdcId)
    setActiveFdcId(fdcId)
    setVendorId(rule?.vendorId ?? '')
    setProductName(rule?.productName ?? '')
    open()
  }

  function saveWizard() {
    if (activeFdcId == null) return
    const line = ingredientDemand[String(activeFdcId)]
    if (!line) return

    const next = upsertSourcingRule(household, {
      fdcId: activeFdcId,
      ingredientName: line.description,
      vendorId: (vendorId || undefined) as any,
      productName: productName.trim() || undefined,
    })

    setHousehold(next)
    close()
  }

  function pantryGramsFor(fdcId: number): number {
    // v0: subtract only pantry items that specify fdcId AND use unit "g"
    const matches = household.pantry.filter(p => p.fdcId === fdcId && (p.unit ?? '').toLowerCase() === 'g')
    return matches.reduce((sum, p) => sum + (typeof p.quantity === 'number' ? p.quantity : 0), 0)
  }

  const lines = useMemo(() => {
    const q = query.trim().toLowerCase()

    const arr = Object.values(ingredientDemand).map(d => {
      const pantry = pantryGramsFor(d.fdcId)
      const used = Math.min(d.totalGrams, pantry)
      const needed = Math.max(0, d.totalGrams - pantry)
      const currentStatus = statusMap[String(d.fdcId)] ?? defaultStatusFor(needed)

      const rule = findSourcingRule(household, d.fdcId)
      const vendor = rule?.vendorId ? household.vendors.find(v => v.id === rule.vendorId) : undefined

      return {
        ...d,
        pantryGrams: pantry,
        pantryUsedGrams: used,
        neededGrams: needed,
        status: currentStatus,
        sourcing: rule
          ? `${vendorLabel(vendor)}${rule.productName ? ` · ${rule.productName}` : ''}`
          : 'Unsourced',
        hasSourcing: Boolean(rule?.vendorId || rule?.productName),
      }
    })

    const filtered = arr
      .filter(x => (q ? x.description.toLowerCase().includes(q) : true))
      .filter(x => (filter === 'all' ? true : x.status === filter))

    // Sort: need first, then have, then bought, then skip; within each, by needed grams desc
    const rank: Record<GroceryStatus, number> = { need: 0, have: 1, bought: 2, skip: 3 }
    filtered.sort((a, b) => {
      const ra = rank[a.status]
      const rb = rank[b.status]
      if (ra !== rb) return ra - rb
      return b.neededGrams - a.neededGrams
    })

    return filtered
  }, [ingredientDemand, query, filter, statusMap, household])

  const summary = useMemo(() => {
    const counts = { need: 0, have: 0, bought: 0, skip: 0 }
    for (const d of Object.values(ingredientDemand)) {
      const pantry = pantryGramsFor(d.fdcId)
      const needed = Math.max(0, d.totalGrams - pantry)
      const s = statusMap[String(d.fdcId)] ?? defaultStatusFor(needed)
      counts[s]++
    }
    return counts
  }, [ingredientDemand, statusMap, household])

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Grocery List</Title>
          <Text c="dimmed" size="sm">
            v0 is derived locally. Later this becomes backend-generated + vendor-sourced.
          </Text>
        </div>

        <Group gap="xs">
          <Badge variant="light" color={summary.need > 0 ? 'yellow' : 'green'}>
            {summary.need} need
          </Badge>
          <Badge variant="light">{summary.bought} bought</Badge>
          <Button variant="default" onClick={() => navigate('household')}>
            Household
          </Button>
        </Group>
      </Group>

      <Card withBorder radius="lg" p="md">
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
          <TextInput
            label="Search"
            value={query}
            onChange={e => setQuery(e.currentTarget.value)}
            placeholder="e.g. oats, tofu, spinach…"
          />

          <div>
            <Text size="sm" fw={600}>
              Filter
            </Text>
            <SegmentedControl
              mt={6}
              value={filter}
              onChange={v => setFilter(v as any)}
              data={[
                { label: 'All', value: 'all' },
                { label: 'Need', value: 'need' },
                { label: 'Have', value: 'have' },
                { label: 'Bought', value: 'bought' },
                { label: 'Skip', value: 'skip' },
              ]}
            />
          </div>

          <Group align="flex-end" justify="flex-end">
            <Button
              variant="default"
              color="red"
              onClick={() => setStatusMap({})}
            >
              Reset statuses
            </Button>
          </Group>
        </SimpleGrid>

        <Divider my="md" />

        <Text c="dimmed" size="sm">
          Pantry subtraction only works when pantry items specify <code>fdcId</code> and unit <code>g</code>. That’s deliberate:
          fuzzy matching is a trap.
        </Text>
      </Card>

      {/* Sourcing Wizard */}
      <Modal opened={opened} onClose={close} title="Choose source" centered>
        {!activeLine ? (
          <Text c="dimmed">No item selected.</Text>
        ) : (
          <Stack gap="sm">
            <div>
              <Text fw={700}>{activeLine.description}</Text>
              <Text c="dimmed" size="sm">
                fdcId {activeLine.fdcId}
              </Text>
            </div>

            <TextInput
              label="Vendor (id)"
              placeholder="e.g. azure-standard"
              value={vendorId}
              onChange={e => setVendorId(e.currentTarget.value)}
              description={
                household.vendors.length
                  ? `Known vendors: ${household.vendors.map(v => v.id).join(', ')}`
                  : undefined
              }
            />

            <TextInput
              label="Product name (freeform for v0)"
              placeholder="e.g. Organic rolled oats 5lb"
              value={productName}
              onChange={e => setProductName(e.currentTarget.value)}
            />

            {activeRule && (
              <Text c="dimmed" size="sm">
                Existing: {activeRule.vendorId ?? '—'} · {activeRule.productName ?? '—'}
              </Text>
            )}

            <Group justify="flex-end">
              <Button variant="default" onClick={close}>
                Cancel
              </Button>
              <Button onClick={saveWizard}>
                Save
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* List */}
      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" wrap="wrap">
          <Text fw={700}>Items</Text>
          <Badge variant="light">{lines.length} shown</Badge>
        </Group>

        {lines.length === 0 ? (
          <Text c="dimmed" mt="sm">
            No items match.
          </Text>
        ) : isMobile ? (
          <Stack gap="sm" mt="sm">
            {lines.map(l => (
              <Card key={l.fdcId} withBorder radius="lg" p="md">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} lineClamp={2}>
                      {l.description}
                    </Text>
                    <Text c="dimmed" size="xs">
                      fdcId {l.fdcId}
                    </Text>
                  </div>

                  <Button
                    size="xs"
                    variant="light"
                    color={statusColor(l.status)}
                    onClick={() => {
                      const next = nextStatus(l.status)
                      setStatusMap(prev => ({ ...prev, [String(l.fdcId)]: next }))
                    }}
                  >
                    {l.status.toUpperCase()}
                  </Button>
                </Group>

                <Group mt="sm" justify="space-between">
                  <Text size="sm">
                    Needed: <strong>{formatNumber(l.neededGrams, 0)} g</strong>
                  </Text>
                  <Text c="dimmed" size="sm">
                    Pantry: {formatNumber(l.pantryUsedGrams, 0)} g
                  </Text>
                </Group>

                <Divider my="sm" />

                <Group justify="space-between" wrap="wrap">
                  <Badge variant="light" color={l.hasSourcing ? 'green' : 'yellow'}>
                    {l.hasSourcing ? 'Sourced' : 'Unsourced'}
                  </Badge>

                  <Button size="xs" variant="default" onClick={() => openWizard(l.fdcId)}>
                    Choose source
                  </Button>
                </Group>

                <Text c="dimmed" size="xs" mt="xs">
                  {l.sourcing}
                </Text>
              </Card>
            ))}
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={900} mt="sm">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Ingredient</Table.Th>
                  <Table.Th>Needed (g)</Table.Th>
                  <Table.Th>Pantry used (g)</Table.Th>
                  <Table.Th>Source</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lines.map(l => (
                  <Table.Tr key={l.fdcId}>
                    <Table.Td style={{ width: 140 }}>
                      <Button
                        size="xs"
                        variant="light"
                        color={statusColor(l.status)}
                        onClick={() => {
                          const next = nextStatus(l.status)
                          setStatusMap(prev => ({ ...prev, [String(l.fdcId)]: next }))
                        }}
                      >
                        {l.status.toUpperCase()}
                      </Button>
                    </Table.Td>

                    <Table.Td>
                      <Text fw={650}>{l.description}</Text>
                      <Text c="dimmed" size="xs">
                        fdcId {l.fdcId} · used in {l.recipeIds.length} recipes
                      </Text>
                    </Table.Td>

                    <Table.Td>{formatNumber(l.neededGrams, 0)}</Table.Td>
                    <Table.Td>{formatNumber(l.pantryUsedGrams, 0)}</Table.Td>

                    <Table.Td>
                      <Badge variant="light" color={l.hasSourcing ? 'green' : 'yellow'}>
                        {l.hasSourcing ? 'Sourced' : 'Unsourced'}
                      </Badge>
                      <Text c="dimmed" size="xs" mt={4}>
                        {l.sourcing}
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ width: 160 }}>
                      <Button variant="default" size="xs" onClick={() => openWizard(l.fdcId)}>
                        Choose source
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <Text c="dimmed" size="xs">
        Reality check: sourcing rules should not be freeform long-term. This wizard is a bridge until backend vendor product catalogs exist.
      </Text>
    </Stack>
  )
}
