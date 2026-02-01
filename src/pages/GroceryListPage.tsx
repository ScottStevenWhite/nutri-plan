import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDisclosure } from '@mantine/hooks'

import type { AppPage } from '../routes'
import { useAppState } from '../state/AppStateContext'
import type { GroceryLine, GroceryLineStatus, GroceryList, SourcingRule } from '../state/types'
import { formatNumber, uid } from '../state/utils'
import {
  backendClearGroceryLineStatuses,
  backendDeleteSourcingRule,
  backendSetGroceryLineStatus,
  backendUpsertSourcingRule,
  fetchGroceryList,
} from '../backend/api'

type Props = {
  navigate: (page: AppPage) => void
}

function statusColor(s: GroceryLineStatus): string {
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

function nextStatus(s: GroceryLineStatus): GroceryLineStatus {
  if (s === 'need') return 'have'
  if (s === 'have') return 'bought'
  if (s === 'bought') return 'skip'
  return 'need'
}

function lineMatchesQuery(line: GroceryLine, q: string): boolean {
  if (!q) return true
  const hay = [
    line.name,
    line.vendorName ?? '',
    line.vendorProductName ?? '',
    ...(line.usedBy ?? []),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export default function GroceryListPage({ navigate }: Props) {
  const { state, backendStatus, refresh } = useAppState()

  const [list, setList] = useState<GroceryList | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string>('')

  const [query, setQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | GroceryLineStatus>('all')

  const [opened, { open, close }] = useDisclosure(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  // Source mapping modal fields
  const [vendorId, setVendorId] = useState<string>('')
  const [vendorProductId, setVendorProductId] = useState<string>('')
  const [overrideGpp, setOverrideGpp] = useState<number | ''>('')

  const activeLine: GroceryLine | undefined = useMemo(() => {
    if (!list || !activeKey) return undefined
    for (const sec of list.vendors) {
      const found = sec.lines.find(l => l.key === activeKey)
      if (found) return found
    }
    return undefined
  }, [list, activeKey])

  async function load() {
    setErr('')
    setLoading(true)
    try {
      const gl = await fetchGroceryList()
      setList(gl)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // re-run when the plan id changes (new week)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.plan.id])

  const summary = useMemo(() => {
    const counts = { need: 0, have: 0, bought: 0, skip: 0 }
    for (const sec of list?.vendors ?? []) {
      for (const l of sec.lines ?? []) {
        counts[l.status]++
      }
    }
    return counts
  }, [list])

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    const secs = list?.vendors ?? []

    return secs
      .map(sec => {
        const lines = (sec.lines ?? [])
          .filter(l => (filterStatus === 'all' ? true : l.status === filterStatus))
          .filter(l => lineMatchesQuery(l, q))
        return { ...sec, lines }
      })
      .filter(sec => sec.lines.length > 0)
  }, [list, query, filterStatus])

  const vendorOptions = useMemo(
    () => state.household.vendors.map(v => ({ value: v.id, label: `${v.name} (${v.type})` })),
    [state.household.vendors],
  )

  const vendorProductsForVendor = useMemo(() => {
    const all = state.household.vendorProducts ?? []
    const filtered = vendorId ? all.filter(p => p.vendorId === vendorId) : all
    return filtered
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => ({ value: p.id, label: p.name }))
  }, [state.household.vendorProducts, vendorId])

  function openSourceModal(line: GroceryLine) {
    setActiveKey(line.key)

    // prefill vendor/product if already sourced
    const existingVp = line.vendorProductId
      ? state.household.vendorProducts.find(p => p.id === line.vendorProductId)
      : undefined

    setVendorId(existingVp?.vendorId ?? line.vendorId ?? '')
    setVendorProductId(line.vendorProductId ?? '')
    setOverrideGpp(typeof line.gramsPerPackage === 'number' ? line.gramsPerPackage : '')
    open()
  }

  async function saveSourceMapping() {
    if (!activeLine) return
    if (!activeLine.fdcId) {
      notifications.show({ title: 'Cannot map source', message: 'This line has no fdcId.', color: 'red' })
      return
    }
    if (!vendorProductId) {
      notifications.show({ title: 'Pick a product', message: 'Select a vendor product.', color: 'yellow' })
      return
    }

    const existingRule = state.household.sourcingRules.find(r => r.fdcId === activeLine.fdcId)
    const ruleId = existingRule?.id ?? uid()

    const gpp = typeof overrideGpp === 'number' && Number.isFinite(overrideGpp) && overrideGpp > 0 ? overrideGpp : undefined

    const rule: SourcingRule = {
      id: ruleId,
      fdcId: activeLine.fdcId,
      options: [{ vendorProductId, priority: 1, gramsPerPackage: gpp }],
      notes: existingRule?.notes,
    }

    try {
      await backendUpsertSourcingRule(rule)
      await refresh()
      await load()
      close()
      notifications.show({ title: 'Saved', message: 'Sourcing rule updated.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  async function clearSourceMapping() {
    if (!activeLine?.fdcId) return
    const existingRule = state.household.sourcingRules.find(r => r.fdcId === activeLine.fdcId)
    if (!existingRule) return

    try {
      await backendDeleteSourcingRule(existingRule.id)
      await refresh()
      await load()
      close()
      notifications.show({ title: 'Cleared', message: 'Sourcing rule removed.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
    }
  }

  async function setStatus(line: GroceryLine, status: GroceryLineStatus) {
    // optimistic update
    setList(prev => {
      if (!prev) return prev
      const vendors = prev.vendors.map(sec => ({
        ...sec,
        lines: sec.lines.map(l => (l.key === line.key ? { ...l, status } : l)),
      }))
      return { ...prev, vendors }
    })

    try {
      await backendSetGroceryLineStatus(line.key, status)
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
      // re-sync
      await load()
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Grocery List</Title>
          <Text c="dimmed" size="sm">
            Derived by backend from plan + recipes + household + pantry + sourcing rules + saved statuses.
          </Text>
        </div>

        <Group gap="xs" wrap="wrap">
          <Badge variant="light" color={summary.need > 0 ? 'yellow' : 'green'}>
            {summary.need} need
          </Badge>
          <Badge variant="light">{summary.bought} bought</Badge>
          <Button variant="default" onClick={() => navigate('household')}>
            Household
          </Button>
        </Group>
      </Group>

      {backendStatus !== 'online' && (
        <Alert color="yellow" title="Backend not online">
          Grocery list requires the backend.
        </Alert>
      )}

      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <TextInput
            label="Search"
            value={query}
            onChange={e => setQuery(e.currentTarget.value)}
            placeholder="ingredient, vendor, product, recipe…"
            style={{ flex: 1, minWidth: 260 }}
          />

          <Select
            label="Filter status"
            value={filterStatus}
            onChange={v => setFilterStatus((v as any) ?? 'all')}
            data={[
              { value: 'all', label: 'All' },
              { value: 'need', label: 'Need' },
              { value: 'have', label: 'Have' },
              { value: 'bought', label: 'Bought' },
              { value: 'skip', label: 'Skip' },
            ]}
            style={{ width: 200 }}
          />

          <Group>
            <Button variant="default" onClick={load} leftSection={loading ? <Loader size="xs" /> : undefined}>
              Refresh
            </Button>
            <Button
              variant="default"
              color="red"
              onClick={async () => {
                try {
                  await backendClearGroceryLineStatuses()
                  await load()
                  notifications.show({ title: 'Cleared', message: 'All grocery statuses reset.', color: 'green' })
                } catch (e: any) {
                  notifications.show({ title: 'Failed', message: e?.message ?? String(e), color: 'red' })
                }
              }}
            >
              Clear statuses
            </Button>
          </Group>
        </Group>

        {list?.warnings?.length ? (
          <>
            <Divider my="md" />
            <Alert color="yellow" title="Warnings">
              <Stack gap={4}>
                {list.warnings.map((w, i) => (
                  <Text key={i} size="sm">
                    • {w}
                  </Text>
                ))}
              </Stack>
            </Alert>
          </>
        ) : null}

        {err && (
          <>
            <Divider my="md" />
            <Alert color="red" title="Failed to load">
              {err}
            </Alert>
          </>
        )}
      </Card>

      <Modal opened={opened} onClose={close} title="Map source" centered>
        {!activeLine ? (
          <Text c="dimmed">No line selected.</Text>
        ) : (
          <Stack gap="sm">
            <div>
              <Text fw={700}>{activeLine.name}</Text>
              <Text c="dimmed" size="sm">
                key {activeLine.key}
                {activeLine.fdcId ? ` · fdcId ${activeLine.fdcId}` : ''}
              </Text>
            </div>

            <Select
              label="Vendor"
              value={vendorId || null}
              onChange={v => {
                setVendorId(v ?? '')
                setVendorProductId('')
              }}
              data={vendorOptions}
              searchable
              clearable
              nothingFoundMessage="No vendors"
            />

            <Select
              label="Vendor product"
              value={vendorProductId || null}
              onChange={v => setVendorProductId(v ?? '')}
              data={vendorProductsForVendor}
              searchable
              clearable
              nothingFoundMessage="No products"
              description={
                vendorProductsForVendor.length === 0
                  ? 'Add vendor products in Household → Products.'
                  : undefined
              }
            />

            <NumberInput
              label="Grams per package override (optional)"
              value={overrideGpp}
              onChange={setOverrideGpp}
              min={0}
              step={50}
              placeholder="e.g. 2268 for 5 lb"
            />

            <Group justify="space-between" mt="sm">
              <Button variant="default" color="red" onClick={clearSourceMapping}>
                Clear rule
              </Button>

              <Group>
                <Button variant="default" onClick={close}>
                  Cancel
                </Button>
                <Button onClick={saveSourceMapping} disabled={!vendorProductId}>
                  Save
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>

      {loading && !list ? (
        <Card withBorder radius="lg" p="md">
          <Group>
            <Loader size="sm" />
            <Text c="dimmed">Loading grocery list…</Text>
          </Group>
        </Card>
      ) : !list ? (
        <Card withBorder radius="lg" p="md">
          <Text c="dimmed">No grocery list loaded.</Text>
        </Card>
      ) : (
        <Stack gap="md">
          {filteredSections.map(sec => (
            <Card key={sec.vendorId ?? sec.vendorName} withBorder radius="lg" p="md">
              <Group justify="space-between" wrap="wrap">
                <Text fw={800}>{sec.vendorName}</Text>
                <Badge variant="light">{sec.lines.length} lines</Badge>
              </Group>

              <Table.ScrollContainer minWidth={980} mt="sm">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Item</Table.Th>
                      <Table.Th>Need</Table.Th>
                      <Table.Th>Packages</Table.Th>
                      <Table.Th>Used by</Table.Th>
                      <Table.Th>Source</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sec.lines.map(line => (
                      <Table.Tr key={line.key}>
                        <Table.Td style={{ width: 140 }}>
                          <Button
                            size="xs"
                            variant="light"
                            color={statusColor(line.status)}
                            onClick={() => setStatus(line, nextStatus(line.status))}
                          >
                            {line.status.toUpperCase()}
                          </Button>
                        </Table.Td>

                        <Table.Td>
                          <Text fw={650}>{line.name}</Text>
                          <Text c="dimmed" size="xs">
                            {typeof line.needGrams === 'number' ? `${formatNumber(line.needGrams, 0)} g need` : '—'}
                            {typeof line.haveGrams === 'number' ? ` · ${formatNumber(line.haveGrams, 0)} g have` : ''}
                          </Text>
                        </Table.Td>

                        <Table.Td style={{ width: 120 }}>
                          {typeof line.needGrams === 'number' ? `${formatNumber(line.needGrams, 0)} g` : '—'}
                        </Table.Td>

                        <Table.Td style={{ width: 120 }}>
                          {typeof line.packagesToBuy === 'number' ? formatNumber(line.packagesToBuy, 0) : '—'}
                        </Table.Td>

                        <Table.Td>
                          <Text c="dimmed" size="sm" lineClamp={2}>
                            {(line.usedBy ?? []).join(', ') || '—'}
                          </Text>
                        </Table.Td>

                        <Table.Td>
                          <Text size="sm" fw={600}>
                            {line.vendorProductName ?? 'Unsourced'}
                          </Text>
                          <Text c="dimmed" size="xs">
                            {line.vendorName ?? '—'}
                          </Text>
                        </Table.Td>

                        <Table.Td style={{ width: 170 }}>
                          <Button
                            size="xs"
                            variant="default"
                            onClick={() => openSourceModal(line)}
                            disabled={!line.fdcId}
                          >
                            Map source…
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
