import React, { useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Checkbox, Group, Loader, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { useAppState } from '../state/AppStateContext'
import { getFoodDetails, searchFoods } from '../fdc/client'
import { formatNumber } from '../state/utils'

export default function FoodsPage() {
  const { state, dispatch, backendStatus } = useAppState()

  const [query, setQuery] = useState('')
  const [includeBranded, setIncludeBranded] = useState(false)

  const [status, setStatus] = useState<string>('')
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingCacheId, setLoadingCacheId] = useState<number | null>(null)
  const [results, setResults] = useState<any[]>([])

  const cached = useMemo(() => new Set(Object.keys(state.foodCache)), [state.foodCache])

  async function runSearch() {
    const q = query.trim()
    if (!q) return

    setStatus('')
    setLoadingSearch(true)
    try {
      const resp = await searchFoods(q, { pageSize: 25, includeBranded })
      setResults(resp.foods ?? [])
      setStatus(`Found ${resp.foods?.length ?? 0} foods`)
    } catch (e: any) {
      const msg = e?.message ?? String(e)
      setStatus(msg)
      notifications.show({ title: 'Search failed', message: msg, color: 'red' })
    } finally {
      setLoadingSearch(false)
    }
  }

  async function cacheFood(fdcId: number) {
    setStatus('')
    setLoadingCacheId(fdcId)
    try {
      const food = await getFoodDetails(fdcId) // backend query
      dispatch({ type: 'CACHE_FOOD', food }) // persisted by AppStateContext -> backend mutation
      setStatus(`Cached: ${food.description}`)
    } catch (e: any) {
      const msg = e?.message ?? String(e)
      setStatus(msg)
      notifications.show({ title: 'Cache failed', message: msg, color: 'red' })
    } finally {
      setLoadingCacheId(null)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Foods (FoodData Central)</Title>
          <Text c="dimmed" size="sm">
            Search USDA via the local backend. Cache foods you use so recipes can compute totals instantly.
          </Text>
        </div>

        <Badge variant="light">{Object.keys(state.foodCache).length} cached</Badge>
      </Group>

      {backendStatus !== 'online' && (
        <Alert color="yellow" title="Backend not online">
          FDC search + persistence depend on the local GraphQL backend (<code>http://localhost:4000/graphql</code>).
        </Alert>
      )}

      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <TextInput
            label="Search"
            value={query}
            onChange={e => setQuery(e.currentTarget.value)}
            placeholder='Try: "oats", "tofu", "spinach"...'
            style={{ flex: 1, minWidth: 280 }}
            onKeyDown={e => {
              if (e.key === 'Enter') runSearch()
            }}
            rightSection={loadingSearch ? <Loader size="xs" /> : undefined}
          />

          <Button onClick={runSearch} disabled={!query.trim()}>
            Search
          </Button>
        </Group>

        <Group mt="sm" wrap="wrap">
          <Checkbox
            checked={includeBranded}
            onChange={e => setIncludeBranded(e.currentTarget.checked)}
            label="Include Branded foods"
          />
          {status && (
            <Text c="dimmed" size="sm">
              {status}
            </Text>
          )}
        </Group>

        <Text c="dimmed" size="sm" mt="sm">
          Strong opinion: prefer <strong>Foundation</strong> / <strong>SR Legacy</strong> for planning accuracy. Branded label
          data can be noisy.
        </Text>
      </Card>

      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" wrap="wrap">
          <Title order={4}>Results</Title>
          <Badge variant="light">{results.length} items</Badge>
        </Group>

        {results.length === 0 ? (
          <Text c="dimmed" mt="sm">
            No results yet.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={760} mt="sm">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Brand</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {results.map((r: any) => {
                  const id = String(r.fdcId)
                  const isCached = cached.has(id)
                  const isLoading = loadingCacheId === Number(r.fdcId)

                  return (
                    <Table.Tr key={id}>
                      <Table.Td>
                        <Text fw={650}>{r.description}</Text>
                        <Text c="dimmed" size="xs">
                          fdcId {id}
                        </Text>
                      </Table.Td>
                      <Table.Td>{r.dataType ?? '—'}</Table.Td>
                      <Table.Td>{r.brandOwner ?? '—'}</Table.Td>
                      <Table.Td style={{ width: 140 }}>
                        <Button
                          variant={isCached ? 'default' : 'filled'}
                          onClick={() => cacheFood(Number(r.fdcId))}
                          loading={isLoading}
                        >
                          {isCached ? 'Re-cache' : 'Cache'}
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

      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" wrap="wrap">
          <Title order={4}>Cached foods</Title>
          <Badge variant="light">{Object.keys(state.foodCache).length} foods</Badge>
        </Group>

        {Object.keys(state.foodCache).length === 0 ? (
          <Text c="dimmed" mt="sm">
            Nothing cached yet.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={760} mt="sm">
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Nutrients</Table.Th>
                  <Table.Th>Fetched</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.values(state.foodCache)
                  .sort((a, b) => a.description.localeCompare(b.description))
                  .slice(0, 200)
                  .map(food => (
                    <Table.Tr key={food.fdcId}>
                      <Table.Td>
                        <Text fw={650}>{food.description}</Text>
                        <Text c="dimmed" size="xs">
                          fdcId {food.fdcId}
                        </Text>
                      </Table.Td>
                      <Table.Td>{food.dataType ?? '—'}</Table.Td>
                      <Table.Td>{formatNumber(food.foodNutrients.length, 0)}</Table.Td>
                      <Table.Td>
                        <Text c="dimmed" size="sm">
                          {new Date(food.lastFetchedISO).toLocaleString()}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}

        {Object.keys(state.foodCache).length > 200 && (
          <Text c="dimmed" size="sm" mt="sm">
            Showing first 200 cached foods.
          </Text>
        )}
      </Card>
    </Stack>
  )
}
