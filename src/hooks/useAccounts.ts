import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AccountsState, CliAccount, CliKind } from '../types'
import {
  accountByIdForType,
  accountsByType as filterAccountsByType,
  resolveDefaultAccount
} from '../utils/accountSafety'

const EMPTY: AccountsState = { accounts: [], activeByType: {} }

// Loads the linked CLI accounts from the main process and exposes CRUD helpers.
// Every mutation returns the fresh state from main, which we store locally so the
// UI stays in sync without a second round-trip.
export function useAccounts() {
  const [state, setState] = useState<AccountsState>(EMPTY)

  useEffect(() => {
    let cancelled = false
    window.api.accounts
      .list()
      .then((next) => {
        if (!cancelled) setState(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const refresh = useCallback(async () => {
    const next = await window.api.accounts.list()
    setState(next)
    return next
  }, [])

  const add = useCallback(async (type: CliKind, label: string) => {
    const next = await window.api.accounts.add({ type, label })
    setState(next)
    // The newest account of this type is the one we just created.
    let created: CliAccount | undefined
    for (const account of next.accounts) {
      if (account.type === type && (!created || account.createdAt > created.createdAt)) {
        created = account
      }
    }
    return created as CliAccount | undefined
  }, [])

  const remove = useCallback(async (id: string) => {
    setState(await window.api.accounts.remove(id))
  }, [])

  const rename = useCallback(async (id: string, label: string) => {
    setState(await window.api.accounts.rename(id, label))
  }, [])

  const setActive = useCallback(async (type: CliKind, id: string) => {
    setState(await window.api.accounts.setActive(type, id))
  }, [])

  const accountsByType = useCallback(
    (type: CliKind) => filterAccountsByType(state, type),
    [state]
  )

  const accountById = useCallback(
    (id: string | undefined) => (id ? state.accounts.find((a) => a.id === id) : undefined),
    [state.accounts]
  )

  // Resolve the account a new session of `type` should use: the type's active
  // account, falling back to the first linked account of that type.
  const resolveDefault = useCallback(
    (type: CliKind): CliAccount | undefined => {
      return resolveDefaultAccount(state, type)
    },
    [state]
  )

  const accountByIdOfType = useCallback(
    (id: string | undefined, type: CliKind) => accountByIdForType(state, id, type),
    [state]
  )

  return useMemo(
    () => ({
      state,
      accounts: state.accounts,
      activeByType: state.activeByType,
      refresh,
      add,
      remove,
      rename,
      setActive,
      accountsByType,
      accountById,
      accountByIdOfType,
      resolveDefault
    }),
    [state, refresh, add, remove, rename, setActive, accountsByType, accountById, accountByIdOfType, resolveDefault]
  )
}

export type UseAccounts = ReturnType<typeof useAccounts>
