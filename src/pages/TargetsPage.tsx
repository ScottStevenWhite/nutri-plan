import React, { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDisclosure } from '@mantine/hooks'

import { useAppState } from '../state/AppStateContext'
import type { NutrientTarget, PersonProfile } from '../state/types'
import { formatNumber, uid } from '../state/utils'
import { backendGenerateTargets, backendUpsertPerson } from '../backend/api'
import { useLocalStorageState } from '../local/useLocalStorageState'
import { weekTotals } from '../state/calc'

type NutrientOption = {
  nutrientId: number
  name: string
  unitName: string
}

function collectNutrientOptions(foodCache: Record<string, any>): NutrientOption[] {
  const map = new Map<number, NutrientOption>()
  for (const food of Object.values(foodCache ?? {})) {
    for (const n of food?.foodNutrients ?? []) {
      if (!n?.nutrientId) continue
      if (!map.has(n.nutrientId)) {
        map.set(n.nutrientId, { nutrientId: n.nutrientId, name: n.name, unitName: n.unitName })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

const MACROS = [
  { key: 'calories', nutrientId: 1008, name: 'Calories', unitName: 'kcal', hint: 'Energy' },
  { key: 'protein', nutrientId: 1003, name: 'Protein', unitName: 'g', hint: 'Muscle + satiety' },
  { key: 'carbs', nutrientId: 1005, name: 'Carbs', unitName: 'g', hint: 'Energy + performance' },
  { key: 'fat', nutrientId: 1004, name: 'Fat', unitName: 'g', hint: 'Hormones + absorption' },
  { key: 'fiber', nutrientId: 1079, name: 'Fiber', unitName: 'g', hint: 'Gut health' },
] as const

const MACRO_IDS = new Set<number>(MACROS.map(m => m.nutrientId))

type PresetValue = 'blueprint' | 'prePregnancy' | 'pregT1' | 'pregT2' | 'pregT3'

type BaselineTarget = {
  nutrientId: number
  name: string
  unitName: string
  daily: number
  weeklyOverride?: number
}

type TargetBaseline = {
  preset: PresetValue
  storedISO: string
  targets: Record<string, BaselineTarget>
  notes?: string[]
  watchouts?: string[]
}

type TargetBounds = Record<string, { min?: number; max?: number }>

function weeklyValue(daily: number, weeklyOverride?: number): number {
  if (typeof weeklyOverride === 'number' && Number.isFinite(weeklyOverride) && weeklyOverride > 0) return weeklyOverride
  return daily * 7
}

function getTarget(person: PersonProfile, nutrientId: number): NutrientTarget | undefined {
  return person.nutrientTargets?.[String(nutrientId)]
}

function upsertTarget(person: PersonProfile, t: NutrientTarget): PersonProfile {
  return {
    ...person,
    nutrientTargets: {
      ...(person.nutrientTargets ?? {}),
      [String(t.nutrientId)]: t,
    },
  }
}

function removeTarget(person: PersonProfile, nutrientId: number): PersonProfile {
  return {
    ...person,
    nutrientTargets: Object.fromEntries(Object.entries(person.nutrientTargets ?? {}).filter(([k]) => k !== String(nutrientId))),
  }
}

function applyPreset(person: PersonProfile, preset: PresetValue): PersonProfile {
  const base: PersonProfile = {
    ...person,
    prePregnancy: person.prePregnancy ?? { enabled: false },
    pregnancy: person.pregnancy ?? { enabled: false },
  }

  if (preset === 'blueprint') {
    return {
      ...base,
      prePregnancy: { ...(base.prePregnancy ?? { enabled: false }), enabled: false },
      pregnancy: { ...(base.pregnancy ?? { enabled: false }), enabled: false, trimester: undefined },
    }
  }

  if (preset === 'prePregnancy') {
    return {
      ...base,
      prePregnancy: { ...(base.prePregnancy ?? { enabled: false }), enabled: true },
      pregnancy: { ...(base.pregnancy ?? { enabled: false }), enabled: false, trimester: undefined },
    }
  }

  const trimester = preset === 'pregT1' ? 1 : preset === 'pregT2' ? 2 : 3
  return {
    ...base,
    prePregnancy: { ...(base.prePregnancy ?? { enabled: false }), enabled: false },
    pregnancy: { ...(base.pregnancy ?? { enabled: false }), enabled: true, trimester },
  }
}

export default function TargetsPage() {
  const { state, dispatch, refresh, backendStatus } = useAppState()

  const person = state.people.find(p => p.id === state.selectedPersonId)
  const personOptions = state.people.map(p => ({ value: p.id, label: p.name }))

  const nutrientOptions = useMemo(() => collectNutrientOptions(state.foodCache), [state.foodCache])
  const nutrientSelectData = useMemo(
    () =>
      nutrientOptions.map(o => ({
        value: String(o.nutrientId),
        label: `${o.name} (${o.unitName})`,
      })),
    [nutrientOptions],
  )

  const baselineKey = `nutri-plan::targetsBaseline::${person?.id ?? 'none'}`
  const boundsKey = `nutri-plan::targetsBounds::${person?.id ?? 'none'}`

  const [baseline, setBaseline] = useLocalStorageState<TargetBaseline | null>(baselineKey, null)
  const [bounds, setBounds] = useLocalStorageState<TargetBounds>(boundsKey, {})

  const recipesById = useMemo(() => {
    const m: Record<string, any> = {}
    for (const r of state.recipes) m[r.id] = r
    return m
  }, [state.recipes])

  const bundleTotals = useMemo(() => weekTotals(state.plan, recipesById, state.foodCache), [state.plan, recipesById, state.foodCache])

  // -----------------------
  // Page-level person picker
  // -----------------------
  function selectPerson(personId: string | undefined) {
    dispatch({ type: 'SELECT_PERSON', personId })
  }

  // -----------------------
  // Profiles (minimal, sane)
  // -----------------------
  const [newName, setNewName] = useState('')
  const [rename, setRename] = useState('')

  React.useEffect(() => {
    setRename(person?.name ?? '')
  }, [person?.id])

  function createPerson() {
    const n = newName.trim()
    if (!n) return
    const p: PersonProfile = {
      id: uid(),
      name: n,
      sex: 'male',
      allergies: [],
      supplements: [],
      weightLog: [],
      nutrientTargets: {},
      watchouts: [],
      notes: '',
      pregnancy: { enabled: false },
      prePregnancy: { enabled: false },
    }
    dispatch({ type: 'UPSERT_PERSON', person: p })
    selectPerson(p.id)
    setNewName('')
  }

  function saveRename() {
    if (!person) return
    const n = rename.trim()
    if (!n) return
    dispatch({ type: 'UPSERT_PERSON', person: { ...person, name: n } })
  }

  // -----------------------
  // Presets + generation
  // -----------------------
  const [preset, setPreset] = useState<PresetValue>('blueprint')
  const [overwrite, setOverwrite] = useState(true)
  const [includeMicros, setIncludeMicros] = useState(true)
  const [generating, setGenerating] = useState(false)

  async function runGenerateTargets() {
    if (!person) return
    if (backendStatus !== 'online') {
      notifications.show({ title: 'Backend offline', message: 'Targets generation requires the backend.', color: 'red' })
      return
    }

    setGenerating(true)
    try {
      // Ensure preset state is persisted BEFORE generation so backend can use it (now or later).
      const updated = applyPreset(person, preset)
      await backendUpsertPerson(updated)

      const result = await backendGenerateTargets({
        personId: updated.id,
        overwrite,
        includeMicronutrients: includeMicros,
      })

      const generated: any[] = Array.isArray(result?.generated) ? result.generated : []
      const targets: Record<string, BaselineTarget> = {}
      for (const t of generated) {
        if (!t?.nutrientId) continue
        targets[String(t.nutrientId)] = {
          nutrientId: Number(t.nutrientId),
          name: String(t.name ?? ''),
          unitName: String(t.unitName ?? ''),
          daily: Number(t.daily ?? 0),
          weeklyOverride: typeof t.weeklyOverride === 'number' ? t.weeklyOverride : undefined,
        }
      }

      const notes: string[] = Array.isArray(result?.notes) ? result.notes.map((x: any) => String(x)) : []
      const watchouts: string[] = Array.isArray(result?.watchouts) ? result.watchouts.map((x: any) => String(x)) : []

      setBaseline({
        preset,
        storedISO: new Date().toISOString(),
        targets,
        notes,
        watchouts,
      })

      notifications.show({
        title: 'Targets generated',
        message: notes[0] ?? 'Baseline targets generated.',
        color: 'green',
      })

      await refresh()
    } catch (e: any) {
      notifications.show({ title: 'Generation failed', message: e?.message ?? String(e), color: 'red' })
    } finally {
      setGenerating(false)
    }
  }

  // -----------------------
  // Editing modal (macros + micros)
  // -----------------------
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [activeNutrientId, setActiveNutrientId] = useState<number | null>(null)
  const [activeName, setActiveName] = useState<string>('')
  const [activeUnit, setActiveUnit] = useState<string>('')

  const [editDaily, setEditDaily] = useState<number | ''>('')
  const [editWeeklyOverride, setEditWeeklyOverride] = useState<number | ''>('')

  const [editMin, setEditMin] = useState<number | ''>('')
  const [editMax, setEditMax] = useState<number | ''>('')

  const [editMode, setEditMode] = useState<'macro' | 'micro'>('macro')

  function beginEdit(nutrientId: number, name: string, unitName: string, mode: 'macro' | 'micro') {
    if (!person) return
    setEditMode(mode)
    setActiveNutrientId(nutrientId)
    setActiveName(name)
    setActiveUnit(unitName)

    const existing = getTarget(person, nutrientId)
    setEditDaily(typeof existing?.daily === 'number' ? existing.daily : '')
    setEditWeeklyOverride(typeof existing?.weeklyOverride === 'number' ? existing.weeklyOverride : '')

    const b = bounds[String(nutrientId)] ?? {}
    setEditMin(typeof b.min === 'number' ? b.min : '')
    setEditMax(typeof b.max === 'number' ? b.max : '')

    openEdit()
  }

  function saveEdit() {
    if (!person) return
    if (!activeNutrientId) return
    if (typeof editDaily !== 'number' || !Number.isFinite(editDaily) || editDaily <= 0) return

    const weekly =
      typeof editWeeklyOverride === 'number' && Number.isFinite(editWeeklyOverride) && editWeeklyOverride > 0
        ? editWeeklyOverride
        : undefined

    const t: NutrientTarget = {
      nutrientId: activeNutrientId,
      name: activeName,
      unitName: activeUnit,
      daily: editDaily,
      weeklyOverride: weekly,
    }

    dispatch({ type: 'UPSERT_PERSON', person: upsertTarget(person, t) })

    // Min/Max are mocked locally until backend supports safety bounds.
    const min =
      typeof editMin === 'number' && Number.isFinite(editMin) && editMin >= 0 ? editMin : undefined
    const max =
      typeof editMax === 'number' && Number.isFinite(editMax) && editMax > 0 ? editMax : undefined

    setBounds(prev => ({ ...prev, [String(activeNutrientId)]: { min, max } }))

    closeEdit()
  }

  function deleteTarget() {
    if (!person) return
    if (!activeNutrientId) return
    dispatch({ type: 'UPSERT_PERSON', person: removeTarget(person, activeNutrientId) })
    setBounds(prev => {
      const next = { ...prev }
      delete next[String(activeNutrientId)]
      return next
    })
    closeEdit()
  }

  // -----------------------
  // Micros add UI
  // -----------------------
  const [addNutrientId, setAddNutrientId] = useState<string | null>(null)
  const [addDaily, setAddDaily] = useState<number | ''>('')

  function addMicroTarget() {
    if (!person) return
    if (!addNutrientId) return
    const opt = nutrientOptions.find(o => String(o.nutrientId) === addNutrientId)
    if (!opt) return
    if (typeof addDaily !== 'number' || !Number.isFinite(addDaily) || addDaily <= 0) return

    const t: NutrientTarget = {
      nutrientId: opt.nutrientId,
      name: opt.name,
      unitName: opt.unitName,
      daily: addDaily,
      weeklyOverride: undefined,
    }

    dispatch({ type: 'UPSERT_PERSON', person: upsertTarget(person, t) })
    setAddNutrientId(null)
    setAddDaily('')
  }

  // -----------------------
  // Derived: lists
  // -----------------------
  const macroRows = useMemo(() => {
    if (!person) return []
    return MACROS.map(m => {
      const t = getTarget(person, m.nutrientId)
      const daily = t?.daily
      const weekly = typeof daily === 'number' ? weeklyValue(daily, t?.weeklyOverride) : undefined
      const actual = bundleTotals[String(m.nutrientId)]?.amount ?? 0
      const target = weekly ?? 0
      const delta = target > 0 ? actual - target : 0
      return { ...m, t, daily, weekly, actual, target, delta }
    })
  }, [person, bundleTotals])

  const microTargets = useMemo(() => {
    if (!person) return []
    return Object.values(person.nutrientTargets ?? {})
      .filter(t => !MACRO_IDS.has(t.nutrientId))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [person])

  const [microQuery, setMicroQuery] = useState('')
  const filteredMicros = useMemo(() => {
    const q = microQuery.trim().toLowerCase()
    if (!q) return microTargets
    return microTargets.filter(t => `${t.name} ${t.unitName}`.toLowerCase().includes(q))
  }, [microTargets, microQuery])

  // -----------------------
  // Overrides view (local baseline vs current)
  // -----------------------
  const overrides = useMemo(() => {
    if (!person || !baseline?.targets) return []
    const out: Array<{
      nutrientId: number
      name: string
      unitName: string
      baselineDaily: number
      currentDaily: number
      baselineWeekly: number
      currentWeekly: number
    }> = []

    for (const bt of Object.values(baseline.targets)) {
      const cur = getTarget(person, bt.nutrientId)
      if (!cur) continue
      const baselineWeekly = weeklyValue(bt.daily, bt.weeklyOverride)
      const currentWeekly = weeklyValue(cur.daily, cur.weeklyOverride)

      const changed = cur.daily !== bt.daily || (cur.weeklyOverride ?? undefined) !== (bt.weeklyOverride ?? undefined)
      if (!changed) continue

      out.push({
        nutrientId: bt.nutrientId,
        name: bt.name,
        unitName: bt.unitName,
        baselineDaily: bt.daily,
        currentDaily: cur.daily,
        baselineWeekly,
        currentWeekly,
      })
    }

    out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  }, [person, baseline])

  function resetOverrides() {
    if (!person || !baseline?.targets) return
    let next = person
    for (const bt of Object.values(baseline.targets)) {
      const cur = getTarget(next, bt.nutrientId)
      if (!cur) continue
      const changed = cur.daily !== bt.daily || (cur.weeklyOverride ?? undefined) !== (bt.weeklyOverride ?? undefined)
      if (!changed) continue

      next = upsertTarget(next, {
        nutrientId: bt.nutrientId,
        name: bt.name,
        unitName: bt.unitName,
        daily: bt.daily,
        weeklyOverride: bt.weeklyOverride,
      })
    }
    dispatch({ type: 'UPSERT_PERSON', person: next })
  }

  // -----------------------
  // Why / notes
  // -----------------------
  const [notesDraft, setNotesDraft] = useState('')
  React.useEffect(() => {
    setNotesDraft(person?.notes ?? '')
  }, [person?.id])

  function saveNotes() {
    if (!person) return
    dispatch({ type: 'UPSERT_PERSON', person: { ...person, notes: notesDraft } })
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Targets</Title>
          <Text c="dimmed" size="sm">
            Presets → Macros → Micros → Overrides → Why.
          </Text>
        </div>
        <Badge variant="light">{person ? Object.keys(person.nutrientTargets ?? {}).length : 0} targets</Badge>
      </Group>

      <Card p="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Select
            label="Person"
            data={personOptions}
            value={state.selectedPersonId ?? null}
            placeholder="Select…"
            onChange={v => selectPerson(v || undefined)}
            searchable
            style={{ minWidth: 240 }}
          />

          <Group>
            <TextInput
              label="New person"
              value={newName}
              onChange={e => setNewName(e.currentTarget.value)}
              placeholder="Scott"
              style={{ width: 220 }}
            />
            <Button onClick={createPerson} disabled={!newName.trim()}>
              Add
            </Button>
          </Group>
        </Group>

        {!person ? (
          <Alert mt="md" color="yellow" title="No person selected">
            Select or create a person to manage targets.
          </Alert>
        ) : (
          <Tabs defaultValue="targets" mt="md">
            <Tabs.List>
              <Tabs.Tab value="targets">Targets</Tabs.Tab>
              <Tabs.Tab value="profiles">Profile</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="profiles" pt="md">
              <Card p="md">
                <Group align="flex-end" wrap="wrap" justify="space-between">
                  <TextInput
                    label="Name"
                    value={rename}
                    onChange={e => setRename(e.currentTarget.value)}
                    style={{ flex: 1, minWidth: 240 }}
                  />
                  <Group>
                    <Button onClick={saveRename} disabled={!rename.trim()}>
                      Save
                    </Button>
                    <Button
                      color="red"
                      variant="default"
                      onClick={() => dispatch({ type: 'DELETE_PERSON', personId: person.id })}
                    >
                      Delete person
                    </Button>
                  </Group>
                </Group>

                <Text c="dimmed" size="sm" mt="sm">
                  This profile area stays lightweight in v0. The target workflow is the main product.
                </Text>
              </Card>
            </Tabs.Panel>

            <Tabs.Panel value="targets" pt="md">
              <Tabs defaultValue="presets">
                <Tabs.List>
                  <Tabs.Tab value="presets">Presets</Tabs.Tab>
                  <Tabs.Tab value="macros">Macros</Tabs.Tab>
                  <Tabs.Tab value="micros">Micros</Tabs.Tab>
                  <Tabs.Tab value="overrides">Overrides</Tabs.Tab>
                  <Tabs.Tab value="why">Why / Notes</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="presets" pt="md">
                  <Card p="md">
                    <Group justify="space-between" wrap="wrap">
                      <div>
                        <Title order={4}>Presets</Title>
                        <Text c="dimmed" size="sm" mt={4}>
                          Baselines are generated by backend. We store a local snapshot so we can show overrides.
                        </Text>
                      </div>
                      <Badge variant="light">backend</Badge>
                    </Group>

                    <Group mt="md" align="flex-end" wrap="wrap">
                      <Select
                        label="Preset"
                        value={preset}
                        onChange={v => setPreset((v as PresetValue) ?? 'blueprint')}
                        data={[
                          { value: 'blueprint', label: 'Blueprint baseline' },
                          { value: 'prePregnancy', label: 'Pre-pregnancy (preset)' },
                          { value: 'pregT1', label: 'Pregnancy — Trimester 1 (preset)' },
                          { value: 'pregT2', label: 'Pregnancy — Trimester 2 (preset)' },
                          { value: 'pregT3', label: 'Pregnancy — Trimester 3 (preset)' },
                        ]}
                        style={{ minWidth: 320 }}
                      />

                      <Checkbox
                        checked={overwrite}
                        onChange={e => setOverwrite(e.currentTarget.checked)}
                        label="Overwrite existing targets"
                      />

                      <Checkbox
                        checked={includeMicros}
                        onChange={e => setIncludeMicros(e.currentTarget.checked)}
                        label="Include micronutrients"
                      />

                      <Button onClick={runGenerateTargets} loading={generating}>
                        Generate baseline
                      </Button>
                    </Group>

                    <Divider my="md" />

                    <Group justify="space-between" wrap="wrap">
                      <div>
                        <Text fw={800}>Status</Text>
                        <Text c="dimmed" size="sm" mt={4}>
                          Backend: <strong>{backendStatus}</strong>
                        </Text>
                        <Text c="dimmed" size="sm">
                          Last baseline snapshot: <strong>{baseline?.storedISO ? new Date(baseline.storedISO).toLocaleString() : 'none'}</strong>
                        </Text>
                      </div>

                      <div>
                        <Text fw={800}>Backend warnings</Text>
                        <Text c="dimmed" size="sm" mt={4}>
                          {person.watchouts?.length ? `${person.watchouts.length} watchouts` : 'none'}
                        </Text>
                      </div>
                    </Group>

                    {baseline?.notes?.length ? (
                      <Alert mt="md" color="blue" title="Generation notes (last run)">
                        <Stack gap={4}>
                          {baseline.notes.slice(0, 4).map((n, i) => (
                            <Text key={i} size="sm">
                              • {n}
                            </Text>
                          ))}
                        </Stack>
                      </Alert>
                    ) : null}
                  </Card>
                </Tabs.Panel>

                <Tabs.Panel value="macros" pt="md">
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    {macroRows.map(m => {
                      const pct = m.target > 0 ? (m.actual / m.target) * 100 : 0
                      const weeklyLabel = m.weekly ? `${formatNumber(m.weekly, 0)} ${m.unitName} / week` : 'No target set'
                      const actualLabel = `${formatNumber(m.actual, 0)} ${m.unitName} actual`

                      return (
                        <Card key={m.nutrientId} p="md">
                          <Group justify="space-between" wrap="nowrap" align="flex-start">
                            <div style={{ minWidth: 0 }}>
                              <Text fw={900} lineClamp={1}>
                                {m.name}
                              </Text>
                              <Text c="dimmed" size="sm">
                                {m.hint}
                              </Text>
                            </div>

                            <Badge variant="light">{m.unitName}</Badge>
                          </Group>

                          <Divider my="sm" />

                          <Stack gap={6}>
                            <Text size="sm">
                              <strong>Target:</strong> {weeklyLabel}
                            </Text>
                            <Text size="sm">
                              <strong>Bundle:</strong> {actualLabel}
                            </Text>

                            <Text size="sm" c={m.delta >= 0 ? 'green' : 'dimmed'}>
                              <strong>Δ:</strong> {m.delta >= 0 ? '+' : ''}
                              {formatNumber(m.delta, 0)} {m.unitName} ({formatNumber(pct, 0)}%)
                            </Text>
                          </Stack>

                          <Group mt="md" justify="space-between" wrap="wrap">
                            <Button
                              variant="default"
                              onClick={() => beginEdit(m.nutrientId, m.name, m.unitName, 'macro')}
                            >
                              Edit
                            </Button>

                            {!m.t ? (
                              <Text c="dimmed" size="xs">
                                Not set yet (generate a preset, or edit manually).
                              </Text>
                            ) : (
                              <Text c="dimmed" size="xs">
                                Weekly = override or daily×7
                              </Text>
                            )}
                          </Group>
                        </Card>
                      )
                    })}
                  </SimpleGrid>
                </Tabs.Panel>

                <Tabs.Panel value="micros" pt="md">
                  <Stack gap="md">
                    <Card p="md">
                      <Group justify="space-between" wrap="wrap">
                        <div>
                          <Title order={4}>Micronutrients</Title>
                          <Text c="dimmed" size="sm" mt={4}>
                            Min/Max are mocked locally (until backend supports safety bounds). Target is backend-persisted.
                          </Text>
                        </div>
                        <Badge variant="light">{microTargets.length} micros</Badge>
                      </Group>

                      {nutrientOptions.length === 0 ? (
                        <Alert mt="md" color="yellow" title="No nutrient catalog available yet">
                          Cache at least one food first (Foods tab). Then you can add micros from discovered nutrient IDs.
                        </Alert>
                      ) : (
                        <Group mt="md" align="flex-end" wrap="wrap">
                          <Select
                            label="Add micro target"
                            data={nutrientSelectData}
                            value={addNutrientId}
                            onChange={setAddNutrientId}
                            searchable
                            clearable
                            nothingFoundMessage="No match"
                            style={{ flex: 1, minWidth: 320 }}
                          />

                          <NumberInput
                            label="Target (daily)"
                            value={addDaily}
                            onChange={setAddDaily}
                            min={0}
                            step={1}
                            style={{ width: 200 }}
                          />

                          <Button onClick={addMicroTarget} disabled={!addNutrientId || typeof addDaily !== 'number' || addDaily <= 0}>
                            Add
                          </Button>
                        </Group>
                      )}
                    </Card>

                    <Card p="md">
                      <Group justify="space-between" wrap="wrap">
                        <Text fw={900}>Targets table</Text>
                        <TextInput
                          placeholder="Search micros…"
                          value={microQuery}
                          onChange={e => setMicroQuery(e.currentTarget.value)}
                          style={{ width: 260 }}
                        />
                      </Group>

                      {filteredMicros.length === 0 ? (
                        <Text c="dimmed" mt="sm">
                          No micros found.
                        </Text>
                      ) : (
                        <Table.ScrollContainer minWidth={980} mt="sm">
                          <Table striped highlightOnHover>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Nutrient</Table.Th>
                                <Table.Th>Min</Table.Th>
                                <Table.Th>Target</Table.Th>
                                <Table.Th>Max</Table.Th>
                                <Table.Th>Weekly</Table.Th>
                                <Table.Th />
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {filteredMicros.map(t => {
                                const b = bounds[String(t.nutrientId)] ?? {}
                                const min = typeof b.min === 'number' ? b.min : undefined
                                const max = typeof b.max === 'number' ? b.max : undefined
                                const weekly = weeklyValue(t.daily, t.weeklyOverride)

                                return (
                                  <Table.Tr key={t.nutrientId}>
                                    <Table.Td>
                                      <Text fw={650}>{t.name}</Text>
                                      <Text c="dimmed" size="xs">
                                        {t.unitName}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>{typeof min === 'number' ? formatNumber(min) : '—'}</Table.Td>
                                    <Table.Td>
                                      {formatNumber(t.daily)} {t.unitName}
                                    </Table.Td>
                                    <Table.Td>{typeof max === 'number' ? formatNumber(max) : '—'}</Table.Td>
                                    <Table.Td>
                                      {formatNumber(weekly)} {t.unitName}
                                    </Table.Td>
                                    <Table.Td style={{ width: 140 }}>
                                      <Button
                                        size="xs"
                                        variant="default"
                                        onClick={() => beginEdit(t.nutrientId, t.name, t.unitName, 'micro')}
                                      >
                                        Edit
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
                </Tabs.Panel>

                <Tabs.Panel value="overrides" pt="md">
                  <Card p="md">
                    <Group justify="space-between" wrap="wrap">
                      <div>
                        <Title order={4}>Overrides</Title>
                        <Text c="dimmed" size="sm" mt={4}>
                          Shows what differs from your last generated baseline snapshot.
                        </Text>
                      </div>

                      <Group gap="xs">
                        <Badge variant="light">{overrides.length} overridden</Badge>
                        <Button variant="default" onClick={resetOverrides} disabled={!overrides.length}>
                          Reset to baseline
                        </Button>
                      </Group>
                    </Group>

                    {!baseline?.storedISO ? (
                      <Alert mt="md" color="yellow" title="No baseline snapshot">
                        Generate a preset baseline first. Then overrides become meaningful.
                      </Alert>
                    ) : overrides.length === 0 ? (
                      <Text c="dimmed" mt="md">
                        No overrides detected (relative to {new Date(baseline.storedISO).toLocaleString()}).
                      </Text>
                    ) : (
                      <Table.ScrollContainer minWidth={980} mt="md">
                        <Table striped highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Nutrient</Table.Th>
                              <Table.Th>Baseline daily</Table.Th>
                              <Table.Th>Current daily</Table.Th>
                              <Table.Th>Baseline weekly</Table.Th>
                              <Table.Th>Current weekly</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {overrides.map(o => (
                              <Table.Tr key={o.nutrientId}>
                                <Table.Td>
                                  <Text fw={650}>{o.name}</Text>
                                  <Text c="dimmed" size="xs">
                                    {o.unitName}
                                  </Text>
                                </Table.Td>
                                <Table.Td>{formatNumber(o.baselineDaily)} {o.unitName}</Table.Td>
                                <Table.Td>{formatNumber(o.currentDaily)} {o.unitName}</Table.Td>
                                <Table.Td>{formatNumber(o.baselineWeekly)} {o.unitName}</Table.Td>
                                <Table.Td>{formatNumber(o.currentWeekly)} {o.unitName}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
                    )}
                  </Card>
                </Tabs.Panel>

                <Tabs.Panel value="why" pt="md">
                  <Stack gap="md">
                    {person.watchouts?.length ? (
                      <Alert color="yellow" title="Backend watchouts">
                        <Stack gap={4}>
                          {person.watchouts.map((w, i) => (
                            <Text key={i} size="sm">
                              • {w}
                            </Text>
                          ))}
                        </Stack>
                      </Alert>
                    ) : (
                      <Alert color="green" title="No backend watchouts">
                        Targets have no warnings right now.
                      </Alert>
                    )}

                    {baseline?.notes?.length ? (
                      <Alert color="blue" title="Why these targets (last generation notes)">
                        <Stack gap={4}>
                          {baseline.notes.map((n, i) => (
                            <Text key={i} size="sm">
                              • {n}
                            </Text>
                          ))}
                        </Stack>
                      </Alert>
                    ) : null}

                    <Card p="md">
                      <Group justify="space-between" wrap="wrap">
                        <Title order={4}>Notes</Title>
                        <Button variant="default" onClick={saveNotes}>
                          Save notes
                        </Button>
                      </Group>

                      <Textarea
                        mt="sm"
                        value={notesDraft}
                        onChange={e => setNotesDraft(e.currentTarget.value)}
                        placeholder="Context, constraints, preferences, what you’re optimizing for…"
                        minRows={4}
                      />

                      <Text c="dimmed" size="xs" mt="sm">
                        This is stored on the backend in the person profile.
                      </Text>
                    </Card>
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Tabs.Panel>
          </Tabs>
        )}
      </Card>

      <Modal opened={editOpened} onClose={closeEdit} centered title={editMode === 'macro' ? 'Edit macro target' : 'Edit micro target'}>
        {!person || !activeNutrientId ? (
          <Text c="dimmed">No target selected.</Text>
        ) : (
          <Stack gap="sm">
            <div>
              <Text fw={900}>{activeName}</Text>
              <Text c="dimmed" size="sm">
                Unit: {activeUnit} {editMode === 'micro' ? '· Min/Max are local-only in v0' : ''}
              </Text>
            </div>

            <Group grow align="flex-end">
              <NumberInput
                label="Daily target"
                value={editDaily}
                onChange={setEditDaily}
                min={0}
                step={activeNutrientId === 1008 ? 50 : 1}
              />

              <NumberInput
                label="Weekly override (optional)"
                value={editWeeklyOverride}
                onChange={setEditWeeklyOverride}
                min={0}
                step={activeNutrientId === 1008 ? 200 : 5}
              />
            </Group>

            {editMode === 'micro' ? (
              <Group grow align="flex-end">
                <NumberInput label="Min (local-only)" value={editMin} onChange={setEditMin} min={0} step={1} />
                <NumberInput label="Max (local-only)" value={editMax} onChange={setEditMax} min={0} step={1} />
              </Group>
            ) : null}

            <Divider />

            <Group justify="space-between">
              <Button color="red" variant="default" onClick={deleteTarget}>
                Remove target
              </Button>

              <Group>
                <Button variant="default" onClick={closeEdit}>
                  Cancel
                </Button>
                <Button onClick={saveEdit} disabled={typeof editDaily !== 'number' || editDaily <= 0}>
                  Save
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
