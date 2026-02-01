import React from 'react'
import { ActionIcon, Badge, Group, Paper, Text, Title, Tooltip, Burger } from '@mantine/core'

type BackendStatus = 'connecting' | 'online' | 'offline'

function backendBadge(status: BackendStatus) {
  const meta =
    status === 'online'
      ? { color: 'green', label: 'Online' }
      : status === 'offline'
        ? { color: 'red', label: 'Offline' }
        : { color: 'yellow', label: 'Connecting' }

  return (
    <Badge variant="dot" color={meta.color} radius="sm">
      Backend: {meta.label}
    </Badge>
  )
}

type Props = {
  opened: boolean
  onToggleNavbar: () => void
  backendStatus: BackendStatus
  planName: string
  planStartDateISO?: string
  personName?: string
  onOpenSettings: () => void
}

export default function AppHeader({
  opened,
  onToggleNavbar,
  backendStatus,
  planName,
  planStartDateISO,
  personName,
  onOpenSettings,
}: Props) {
  return (
    <Paper h="100%" px="md" radius={0} bg="white" withBorder>
      <Group h="100%" justify="space-between" wrap="nowrap">
        <Group wrap="nowrap" gap="sm">
          <Burger opened={opened} onClick={onToggleNavbar} hiddenFrom="sm" size="sm" />
          <div style={{ lineHeight: 1.1 }}>
            <Title order={4}>Nutri Plan</Title>
            <Text size="xs" c="dimmed">
              Slot bundle → review → execute
            </Text>
          </div>
        </Group>

        <Group gap="sm" wrap="nowrap">
          {backendBadge(backendStatus)}

          <Text size="sm" c="dimmed" visibleFrom="sm">
            Bundle: <strong>{planName}</strong>
            {planStartDateISO ? <span style={{ opacity: 0.8 }}> · created {planStartDateISO}</span> : null}
          </Text>

          <Text size="sm" c="dimmed" visibleFrom="md">
            Person: <strong>{personName ?? 'None selected'}</strong>
          </Text>

          <Tooltip label="Settings" withArrow>
            <ActionIcon variant="subtle" onClick={onOpenSettings} aria-label="Open settings">
              <span style={{ fontSize: 16 }}>⚙️</span>
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  )
}
