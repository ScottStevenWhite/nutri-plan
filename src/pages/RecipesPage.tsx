import React, { useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'

import { useAppState } from '../state/AppStateContext'
import type { Ingredient, Recipe, RecipeTag } from '../state/types'
import { uid, formatNumber } from '../state/utils'
import { recipeTotals, pickMacroSnapshot } from '../state/calc'

import { getFoodDetails, searchFoods, type FoodSearchItem } from '../fdc/client'

const TAGS: RecipeTag[] = ['breakfast', 'lunch', 'dinner', 'snack']

type FoodHit = {
  fdcId: number
  description: string
  dataType?: string
  brandOwner?: string
  cached: boolean
}

type SelectItem = { value: string; label: string }
type SelectGroup = { group: string; items: SelectItem[] }

function matchScore(haystack: string, needle: string): number {
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  const idx = h.indexOf(n)
  if (idx === -1) return 1_000_000
  return (idx === 0 ? 0 : 1000) + idx
}

function labelForHit(h: FoodHit): string {
  const bits: string[] = []
  if (h.dataType) bits.push(h.dataType)
  if (h.brandOwner) bits.push(h.brandOwner)
  const meta = bits.length ? ` — ${bits.join(' · ')}` : ''
  return `${h.description}${meta}`
}

export default function RecipesPage() {
  const { state, dispatch } = useAppState()

  const recipes = state.recipes
  const [selectedId, setSelectedId] = useState<string>(recipes[0]?.id ?? '')
  const selected = recipes.find(r => r.id === selectedId)

  const [name, setName] = useState(selected?.name ?? '')
  const [notes, setNotes] = useState(selected?.notes ?? '')
  const [tags, setTags] = useState<RecipeTag[]>(selected?.tags ?? [])

  const [searchValue, setSearchValue] = useState('')
  const [pickedFood, setPickedFood] = useState<FoodHit | null>(null)
  const [includeBranded, setIncludeBranded] = useState(false)
  const [grams, setGrams] = useState<number | ''>(100)

  const [remoteFoods, setRemoteFoods] = useState<FoodSearchItem[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [status, setStatus] = useState<string>('')

  const [debouncedSearch] = useDebouncedValue(searchValue, 250)
  const searchReqRef = useRef(0)

  function upsertRecipe(recipe: Recipe) {
    dispatch({ type: 'UPSERT_RECIPE', recipe })
  }

  function toggleTag(tag: RecipeTag) {
    setTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  function syncFromSelected(r?: Recipe) {
    setName(r?.name ?? '')
    setNotes(r?.notes ?? '')
    setTags(r?.tags ?? [])
    setPickedFood(null)
    setSearchValue('')
    setGrams(100)
    setStatus('')
  }

  React.useEffect(() => {
    syncFromSelected(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const cachedFoods = useMemo(() => Object.values(state.foodCache), [state.foodCache])
  const cachedSet = useMemo(() => new Set(Object.keys(state.foodCache)), [state.foodCache])

  const cachedHits: FoodHit[] = useMemo(() => {
    const q = searchValue.trim().toLowerCase()
    if (!q) return []
    return cachedFoods
      .map(f => ({
        fdcId: f.fdcId,
        description: f.description,
        dataType: f.dataType,
        brandOwner: f.brandOwner,
        cached: true,
      }))
      .filter(h => h.description.toLowerCase().includes(q))
      .sort((a, b) => matchScore(a.description, q) - matchScore(b.description, q))
      .slice(0, 12)
  }, [cachedFoods, searchValue])

  React.useEffect(() => {
    const q = debouncedSearch.trim()
    if (q.length < 2) {
      setRemoteFoods([])
      setLoadingSearch(false)
      return
    }

    const requestId = ++searchReqRef.current
    setLoadingSearch(true)

    searchFoods(q, { pageSize: 25, includeBranded })
      .then(resp => {
        if (requestId !== searchReqRef.current) return
        setRemoteFoods(resp.foods ?? [])
      })
      .catch(e => {
        if (requestId !== searchReqRef.current) return
        setRemoteFoods([])
        setStatus(e?.message ?? String(e))
      })
      .finally(() => {
        if (requestId !== searchReqRef.current) return
        setLoadingSearch(false)
      })
  }, [debouncedSearch, includeBranded])

  const remoteHits: FoodHit[] = useMemo(() => {
    const q = searchValue.trim()
    if (!q) return []
    const seen = new Set<number>()
    return (remoteFoods ?? [])
      .filter(r => typeof r?.fdcId === 'number' && typeof r?.description === 'string')
      .filter(r => {
        if (seen.has(r.fdcId)) return false
        seen.add(r.fdcId)
        return true
      })
      .map(r => ({
        fdcId: r.fdcId,
        description: r.description,
        dataType: r.dataType,
        brandOwner: r.brandOwner,
        cached: cachedSet.has(String(r.fdcId)),
      }))
      .filter(h => !h.cached)
      .slice(0, 25)
  }, [remoteFoods, cachedSet, searchValue])

  const hitsById = useMemo(() => {
    const m = new Map<string, FoodHit>()
    for (const h of cachedHits) m.set(String(h.fdcId), h)
    for (const h of remoteHits) m.set(String(h.fdcId), h)
    return m
  }, [cachedHits, remoteHits])

  const selectData: SelectGroup[] = useMemo(() => {
    const groups: SelectGroup[] = []
    if (cachedHits.length) {
      groups.push({
        group: 'Cached foods',
        items: cachedHits.map(h => ({ value: String(h.fdcId), label: labelForHit(h) })),
      })
    }
    if (remoteHits.length) {
      groups.push({
        group: 'FoodData Central',
        items: remoteHits.map(h => ({ value: String(h.fdcId), label: labelForHit(h) })),
      })
    }
    return groups
  }, [cachedHits, remoteHits])

  async function ensureFoodCached(fdcId: number) {
    const existing = state.foodCache[String(fdcId)]
    if (existing) return existing

    const food = await getFoodDetails(fdcId) // backend query
    dispatch({ type: 'CACHE_FOOD', food })   // persist via backend mutation (queue)
    return food
  }

  async function addIngredientFromPicker() {
    setStatus('')
    if (!selected) return
    if (!pickedFood) return
    if (typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0) return

    try {
      const cachedFood = await ensureFoodCached(pickedFood.fdcId)

      const ing: Ingredient = {
        id: uid(),
        fdcId: cachedFood.fdcId,
        description: cachedFood.description,
        grams,
      }

      const updated: Recipe = { ...selected, ingredients: [...selected.ingredients, ing] }
      upsertRecipe(updated)

      setPickedFood(null)
      setSearchValue('')
      setGrams(100)
      setStatus(`Added: ${cachedFood.description}`)
    } catch (e: any) {
      setStatus(e?.message ?? String(e))
    }
  }

  function saveMeta() {
    const trimmed = name.trim()
    if (!trimmed) return

    const r: Recipe = selected
      ? { ...selected, name: trimmed, tags, notes }
      : { id: uid(), name: trimmed, tags, notes, ingredients: [] }

    upsertRecipe(r)
    if (!selected) setSelectedId(r.id)
  }

  const totals = selected ? recipeTotals(selected, state.foodCache) : {}
  const macros = pickMacroSnapshot(totals)

  return (
    <Stack>
      <Title order={2}>Recipes</Title>

      <Card withBorder radius="md" p="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Select
            label="Select recipe"
            placeholder="Select…"
            value={selectedId || null}
            onChange={v => setSelectedId(v ?? '')}
            data={recipes
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(r => ({ value: r.id, label: r.name }))}
            searchable
            nothingFoundMessage="No recipes yet"
            style={{ minWidth: 320 }}
          />

          <Group>
            <Button
              variant="default"
              onClick={() => {
                const r: Recipe = { id: uid(), name: 'New recipe', tags: [], ingredients: [] }
                upsertRecipe(r)
                setSelectedId(r.id)
              }}
            >
              New recipe
            </Button>

            <Button
              color="red"
              disabled={!selected}
              onClick={() => selected && dispatch({ type: 'DELETE_RECIPE', recipeId: selected.id })}
            >
              Delete
            </Button>
          </Group>
        </Group>
      </Card>

      {!selected ? (
        <Text c="dimmed">Pick or create a recipe.</Text>
      ) : (
        <>
          <Card withBorder radius="md" p="md">
            <Group justify="space-between" wrap="wrap">
              <Title order={4}>Recipe details</Title>
              <Badge variant="light">Ingredients: {selected.ingredients.length}</Badge>
            </Group>

            <Group mt="md" align="flex-end" wrap="wrap">
              <TextInput
                label="Name"
                value={name}
                onChange={e => setName(e.currentTarget.value)}
                placeholder="Recipe name"
                style={{ flex: 1, minWidth: 260 }}
              />
              <Button onClick={saveMeta}>Save</Button>
            </Group>

            <Group mt="md" wrap="wrap">
              {TAGS.map(t => (
                <Checkbox key={t} checked={tags.includes(t)} onChange={() => toggleTag(t)} label={t} />
              ))}
            </Group>

            <Textarea
              mt="md"
              label="Notes"
              value={notes}
              onChange={e => setNotes(e.currentTarget.value)}
              placeholder="Notes (optional)"
            />

            <Group mt="md" wrap="wrap">
              <Badge variant="light">Calories: {formatNumber(macros.calories ?? NaN)} kcal</Badge>
              <Badge variant="light">Protein: {formatNumber(macros.protein ?? NaN)} g</Badge>
              <Badge variant="light">Carbs: {formatNumber(macros.carbs ?? NaN)} g</Badge>
              <Badge variant="light">Fat: {formatNumber(macros.fat ?? NaN)} g</Badge>
              <Badge variant="light">Fiber: {formatNumber(macros.fiber ?? NaN)} g</Badge>
            </Group>
          </Card>

          <Card withBorder radius="md" p="md">
            <Group justify="space-between" wrap="wrap">
              <Title order={4}>Add ingredient</Title>
              {status && <Text c="dimmed" size="sm">{status}</Text>}
            </Group>

            <Group mt="md" align="flex-end" wrap="wrap">
              <Select
                label="Food (cached first, then USDA search)"
                placeholder="Type to search…"
                searchable
                clearable
                nothingFoundMessage={
                  !searchValue.trim()
                    ? 'Type to search…'
                    : (searchValue.trim().length < 2 ? 'Type 2+ characters to search USDA…' : 'Nothing found')
                }
                data={selectData}
                value={pickedFood ? String(pickedFood.fdcId) : null}
                onChange={(value) => {
                  if (!value) {
                    setPickedFood(null)
                    return
                  }
                  const hit = hitsById.get(value)
                  if (hit) setPickedFood(hit)
                }}
                searchValue={searchValue}
                onSearchChange={v => {
                  setSearchValue(v)
                  if (pickedFood && v && !labelForHit(pickedFood).toLowerCase().includes(v.toLowerCase())) {
                    setPickedFood(null)
                  }
                }}
                rightSection={loadingSearch ? <Loader size="xs" /> : undefined}
                style={{ flex: 1, minWidth: 360 }}
              />

              <NumberInput
                label="Grams"
                value={grams}
                onChange={setGrams}
                min={1}
                step={5}
                clampBehavior="strict"
                style={{ width: 140 }}
              />

              <Button
                onClick={addIngredientFromPicker}
                disabled={!pickedFood || typeof grams !== 'number' || grams <= 0}
              >
                Add
              </Button>
            </Group>

            <Group mt="sm" wrap="wrap">
              <Checkbox
                checked={includeBranded}
                onChange={e => setIncludeBranded(e.currentTarget.checked)}
                label="Include Branded foods in USDA search"
              />
              {pickedFood && (
                <Badge variant="light">
                  {pickedFood.cached ? 'Cached' : 'Not cached (will auto-cache on Add)'} · fdcId {pickedFood.fdcId}
                </Badge>
              )}
            </Group>

            <Text c="dimmed" size="sm" mt="sm">
              Cached matches appear immediately; USDA results fill in asynchronously from the local backend.
            </Text>
          </Card>

          <Card withBorder radius="md" p="md">
            <Title order={4}>Ingredients</Title>

            {selected.ingredients.length === 0 ? (
              <Text c="dimmed" mt="sm">No ingredients yet.</Text>
            ) : (
              <Table mt="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Food</Table.Th>
                    <Table.Th>Grams</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {selected.ingredients.map(ing => (
                    <Table.Tr key={ing.id}>
                      <Table.Td>
                        <Text fw={600}>{ing.description}</Text>
                        <Text c="dimmed" size="xs">fdcId {ing.fdcId}</Text>
                      </Table.Td>
                      <Table.Td>{formatNumber(ing.grams)} g</Table.Td>
                      <Table.Td style={{ width: 120 }}>
                        <Button
                          variant="default"
                          onClick={() => {
                            const updated: Recipe = {
                              ...selected,
                              ingredients: selected.ingredients.filter(i => i.id !== ing.id),
                            }
                            upsertRecipe(updated)
                          }}
                        >
                          Remove
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>

          <Card withBorder radius="md" p="md">
            <Group justify="space-between" wrap="wrap">
              <Title order={4}>All nutrients (recipe total)</Title>
              <Badge variant="light">{Object.keys(totals).length} nutrients</Badge>
            </Group>

            {Object.keys(totals).length === 0 ? (
              <Text c="dimmed" mt="sm">No totals yet.</Text>
            ) : (
              <Table mt="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nutrient</Table.Th>
                    <Table.Th>Amount</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.values(totals)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(n => (
                      <Table.Tr key={n.nutrientId}>
                        <Table.Td>
                          {n.name}{' '}
                          <Text span c="dimmed">({n.unitName})</Text>{' '}
                          <Badge variant="light">id {n.nutrientId}</Badge>
                        </Table.Td>
                        <Table.Td>{formatNumber(n.amount)} {n.unitName}</Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </Stack>
  )
}
