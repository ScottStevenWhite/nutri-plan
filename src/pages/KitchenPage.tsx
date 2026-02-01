import React from 'react'
import { Badge, Card, Group, Stack, Tabs, Text, Title } from '@mantine/core'
import { useAppState } from '../state/AppStateContext'
import KitchenEquipmentPanel from '../kitchen/KitchenEquipmentPanel'

export default function KitchenPage() {
  const { state } = useAppState()

  const toolCount = state.household.equipment.items.length

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Kitchen</Title>
          <Text c="dimmed" size="sm">
            Supplies + tools that constrain recipe feasibility and generation.
          </Text>
        </div>
        <Badge variant="light">{toolCount} tools</Badge>
      </Group>

      <Tabs defaultValue="equipment">
        <Tabs.List>
          <Tabs.Tab value="equipment">Equipment</Tabs.Tab>
          <Tabs.Tab value="supplies">Supplies</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="equipment" pt="md">
          <KitchenEquipmentPanel />
        </Tabs.Panel>

        <Tabs.Panel value="supplies" pt="md">
          <Card withBorder radius="lg" p="md">
            <Title order={4}>Kitchen supplies</Title>
            <Text c="dimmed" size="sm" mt={6}>
              Coming soon: this will track non-equipment kitchen supplies that matter for cooking (wraps, parchment,
              storage containers, staples like oils/spices if you want, etc.).
            </Text>

            <Text c="dimmed" size="sm" mt="sm">
              For now: pantry lives in <strong>Household → Pantry</strong>. Tools live in <strong>Kitchen → Equipment</strong>.
            </Text>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
