import React, { useState } from 'react'
import { Alert, Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { backendSetApiKey } from '../backend/api'
import { useAppState } from '../state/AppStateContext'

export default function SettingsPage() {
  const { dispatch, backendStatus } = useAppState()
  const [apiKey, setApiKey] = useState('')

  async function saveKey() {
    const k = apiKey.trim()
    if (!k) return
    try {
      await backendSetApiKey(k)
      setApiKey('')
      notifications.show({
        title: 'Saved',
        message: 'FDC API key stored in local backend.',
        color: 'green',
      })
    } catch (e: any) {
      notifications.show({
        title: 'Failed to save API key',
        message: e?.message ?? String(e),
        color: 'red',
      })
    }
  }

  return (
    <Stack>
      <Title order={2}>Settings</Title>

      <Card withBorder radius="md" p="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Local backend</Title>
            <Text c="dimmed" size="sm" mt={4}>
              Status: <strong>{backendStatus}</strong> (GraphQL at <code>http://localhost:4000/graphql</code>)
            </Text>
          </div>
        </Group>

        <Alert mt="md" color="yellow" variant="light" title="Important">
          This app now persists through the local GraphQL backend (SQLite). Browser localStorage is no longer the source of truth.
          USDA/FDC calls are made server-side (no browser CORS pain).
        </Alert>
      </Card>

      <Card withBorder radius="md" p="md">
        <Title order={4}>FoodData Central API Key</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Stored locally in the backend (or set <code>FDC_API_KEY</code> in backend <code>.env</code>). The UI does not need to keep it.
        </Text>

        <Group mt="md" wrap="wrap">
          <TextInput
            value={apiKey}
            onChange={e => setApiKey(e.currentTarget.value)}
            placeholder="Paste your data.gov API key"
            style={{ flex: 1, minWidth: 260 }}
          />
          <Button onClick={saveKey}>Save</Button>
        </Group>
      </Card>

      <Card withBorder radius="md" p="md">
        <Title order={4}>Data</Title>

        <Group mt="md">
          <Button
            color="red"
            onClick={() => {
              dispatch({ type: 'CLEAR_ALL' })
            }}
          >
            Reset everything
          </Button>
        </Group>

        <Text c="dimmed" size="sm" mt="sm">
          This triggers backend <code>resetAll</code> and then re-hydrates the UI.
        </Text>
      </Card>
    </Stack>
  )
}
