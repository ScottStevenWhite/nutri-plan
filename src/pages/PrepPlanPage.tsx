import React, { useMemo } from 'react'
import { Badge, Button, Card, Checkbox, Divider, Group, Stack, Text, Title } from '@mantine/core'

import type { AppPage } from '../routes'
import { useAppState } from '../state/AppStateContext'
import { computePrepTasks } from '../derive/prep'
import { useLocalStorageState } from '../local/useLocalStorageState'

type Props = {
  navigate: (page: AppPage) => void
}

export default function PrepPlanPage({ navigate }: Props) {
  const { state } = useAppState()

  const recipesById = useMemo(() => {
    const m: Record<string, any> = {}
    for (const r of state.recipes) m[r.id] = r
    return m
  }, [state.recipes])

  const tasks = useMemo(() => computePrepTasks(state.plan, recipesById), [state.plan, recipesById])
  const [done, setDone] = useLocalStorageState<Record<string, boolean>>(`nutri-plan::prepDone::${state.plan.id}`, {})

  const doneCount = tasks.filter(t => done[t.id]).length

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Prep Plan</Title>
          <Text c="dimmed" size="sm">
            v0 is heuristic (no recipe steps yet). It still reduces friction.
          </Text>
        </div>
        <Group gap="xs">
          <Badge variant="light">
            {doneCount}/{tasks.length} done
          </Badge>
          <Button variant="default" onClick={() => navigate('weekPlan')}>
            Edit week
          </Button>
        </Group>
      </Group>

      <Card withBorder radius="lg" p="md">
        <Text fw={700}>Sunday prep</Text>
        <Text c="dimmed" size="sm" mt={4}>
          Until steps/equipment are modeled, this is a “best effort” task list. Don’t overthink it.
        </Text>

        <Divider my="md" />

        {tasks.length === 0 ? (
          <Text c="dimmed">No prep tasks detected. Add more recipes or repeat meals and this becomes useful.</Text>
        ) : (
          <Stack gap="sm">
            {tasks.map(t => (
              <Card key={t.id} withBorder radius="lg" p="md">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} lineClamp={2}>
                      {t.title}
                    </Text>
                    {t.detail && (
                      <Text c="dimmed" size="sm">
                        {t.detail}
                      </Text>
                    )}
                  </div>

                  <Checkbox
                    checked={Boolean(done[t.id])}
                    onChange={e => setDone(prev => ({ ...prev, [t.id]: e.currentTarget.checked }))}
                    aria-label="Done"
                  />
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        <Divider my="md" />

        <Button variant="default" color="red" onClick={() => setDone({})}>
          Reset prep checklist
        </Button>
      </Card>

      <Text c="dimmed" size="xs">
        Next step (backend-aligned): recipe steps + equipment → real prep tasks, not guesses.
      </Text>
    </Stack>
  )
}
