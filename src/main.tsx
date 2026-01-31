import React from 'react'
import ReactDOM from 'react-dom/client'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

import App from './App'
import './styles.css'
import { AppStateProvider } from './state/AppStateContext'
import { theme } from './theme'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <Notifications position="top-right" />
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MantineProvider>
  </React.StrictMode>,
)
