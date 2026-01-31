import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { AppAction, AppState } from './types'
import { appReducer, defaultState, migrateState } from './reducer'
import {
  backendCacheFood,
  backendDeletePerson,
  backendDeleteRecipe,
  backendResetAll,
  backendSetPlan,
  backendSetApiKey,
  backendUpsertPerson,
  backendUpsertRecipe,
  fetchAppState,
} from '../backend/api'
import { notifications } from '@mantine/notifications'

type BackendStatus = 'connecting' | 'online' | 'offline'

type Ctx = {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  backendStatus: BackendStatus
  refresh: () => Promise<void>
}

const AppStateContext = createContext<Ctx | undefined>(undefined)

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatchBase] = useReducer(appReducer, undefined, () => defaultState())
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('connecting')

  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const didWarnOfflineRef = useRef(false)

  const refresh = useCallback(async () => {
    setBackendStatus('connecting')
    try {
      const raw = await fetchAppState()
      const hydrated = raw ? migrateState(raw as AppState) : defaultState()
      dispatchBase({ type: 'HYDRATE', state: hydrated })
      setBackendStatus('online')
    } catch (e: any) {
      setBackendStatus('offline')
      if (!didWarnOfflineRef.current) {
        didWarnOfflineRef.current = true
        notifications.show({
          title: 'Backend not reachable',
          message:
            (e?.message ?? String(e)) +
            '\n\nUI will run, but persistence + FDC search will fail until backend is running.',
          color: 'red',
        })
      }
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const persistAction = useCallback(
    async (action: AppAction) => {
      switch (action.type) {
        case 'HYDRATE':
        case 'SELECT_PERSON':
          return // local-only unless backend adds a mutation for it

        case 'SET_API_KEY':
          await backendSetApiKey(action.apiKey)
          return

        case 'UPSERT_PERSON':
          await backendUpsertPerson(action.person)
          return

        case 'DELETE_PERSON':
          await backendDeletePerson(action.personId)
          return

        case 'UPSERT_RECIPE':
          await backendUpsertRecipe(action.recipe)
          return

        case 'DELETE_RECIPE':
          await backendDeleteRecipe(action.recipeId)
          return

        case 'SET_PLAN':
          await backendSetPlan(action.plan)
          return

        case 'CACHE_FOOD':
          await backendCacheFood(action.food)
          return

        case 'CLEAR_ALL':
          await backendResetAll()
          await refresh()
          return

        default:
          return
      }
    },
    [refresh],
  )

  const dispatch = useCallback(
    (action: AppAction) => {
      // Special-case CLEAR_ALL: don't optimistic-reset to random IDs; let backend reset + rehydrate.
      if (action.type === 'CLEAR_ALL') {
        queueRef.current = queueRef.current
          .then(() => persistAction(action))
          .catch(async (e: any) => {
            notifications.show({
              title: 'Reset failed',
              message: e?.message ?? String(e),
              color: 'red',
            })
            await refresh()
          })
        return
      }

      // optimistic UI
      dispatchBase(action)

      queueRef.current = queueRef.current
        .then(() => persistAction(action))
        .catch(async (e: any) => {
          notifications.show({
            title: 'Backend sync failed',
            message: e?.message ?? String(e),
            color: 'red',
          })
          await refresh()
        })
    },
    [persistAction, refresh],
  )

  const value = useMemo(() => ({ state, dispatch, backendStatus, refresh }), [state, dispatch, backendStatus, refresh])
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): Ctx {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
