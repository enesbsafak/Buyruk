import { useCallback, useEffect, useState } from 'react'
import { useDialog } from '../components/DialogProvider'
import type {
  DbConnectResult,
  DbConnectionInput,
  DbTable,
  SavedDbConnection
} from '../types'

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))

// Owns the PostgreSQL panel's connection lifecycle and schema/table tree. Row
// data, structure and SQL results are fetched by the child views themselves.
export function useDatabase(open: boolean) {
  const dialog = useDialog()
  const [connections, setConnections] = useState<SavedDbConnection[]>([])
  const [active, setActive] = useState<DbConnectResult | null>(null)
  const [schemas, setSchemas] = useState<string[]>([])
  const [schema, setSchema] = useState<string | null>(null)
  const [tables, setTables] = useState<DbTable[]>([])
  const [selected, setSelected] = useState<DbTable | null>(null)
  const [connecting, setConnecting] = useState(false)

  const refreshConnections = useCallback(async () => {
    try {
      setConnections(await window.api.db.listConnections())
    } catch (err) {
      dialog.notify(`Bağlantılar okunamadı: ${errMsg(err)}`, 'error')
    }
  }, [dialog])

  const loadSchemas = useCallback(
    async (connectionId: string): Promise<string | null> => {
      const list = await window.api.db.listSchemas(connectionId)
      setSchemas(list)
      const preferred = list.includes('public') ? 'public' : list[0] ?? null
      setSchema(preferred)
      return preferred
    },
    []
  )

  const refreshTables = useCallback(async () => {
    if (!active || !schema) return
    try {
      setTables(await window.api.db.listTables(active.connectionId, schema))
    } catch (err) {
      dialog.notify(`Tablolar okunamadı: ${errMsg(err)}`, 'error')
    }
  }, [active, schema, dialog])

  // Reload the table list whenever the active connection or selected schema changes.
  useEffect(() => {
    if (!active || !schema) {
      setTables([])
      return
    }
    let cancelled = false
    window.api.db
      .listTables(active.connectionId, schema)
      .then((list) => {
        if (!cancelled) setTables(list)
      })
      .catch((err) => {
        if (!cancelled) dialog.notify(`Tablolar okunamadı: ${errMsg(err)}`, 'error')
      })
    return () => {
      cancelled = true
    }
  }, [active, schema, dialog])

  const adopt = useCallback(
    async (result: DbConnectResult) => {
      setActive(result)
      setSelected(null)
      await loadSchemas(result.connectionId)
    },
    [loadSchemas]
  )

  const connectSaved = useCallback(
    async (id: string) => {
      setConnecting(true)
      try {
        const result = await window.api.db.connect({ savedId: id })
        await adopt(result)
      } catch (err) {
        dialog.notify(errMsg(err), 'error')
      } finally {
        setConnecting(false)
      }
    },
    [adopt, dialog]
  )

  const connectInline = useCallback(
    async (input: DbConnectionInput) => {
      setConnecting(true)
      try {
        const result = await window.api.db.connect({ input })
        await adopt(result)
        // Persist the connection (encrypted) so it is remembered next time.
        try {
          setConnections(await window.api.db.saveConnection(input))
        } catch {
          // saving is best-effort; the live connection still works
        }
        return true
      } catch (err) {
        dialog.notify(errMsg(err), 'error')
        return false
      } finally {
        setConnecting(false)
      }
    },
    [adopt, dialog]
  )

  const saveConnection = useCallback(
    async (input: DbConnectionInput, id?: string) => {
      try {
        setConnections(await window.api.db.saveConnection(input, id))
        dialog.notify('Bağlantı kaydedildi', 'success')
      } catch (err) {
        dialog.notify(`Kaydedilemedi: ${errMsg(err)}`, 'error')
      }
    },
    [dialog]
  )

  const deleteConnection = useCallback(
    async (id: string) => {
      try {
        setConnections(await window.api.db.deleteConnection(id))
      } catch (err) {
        dialog.notify(`Silinemedi: ${errMsg(err)}`, 'error')
      }
    },
    [dialog]
  )

  const disconnect = useCallback(async () => {
    if (!active) return
    const connectionId = active.connectionId
    setActive(null)
    setSchemas([])
    setSchema(null)
    setTables([])
    setSelected(null)
    try {
      await window.api.db.disconnect(connectionId)
    } catch {
      // pool already gone
    }
  }, [active])

  // On open, refresh saved connections and re-adopt an already-live connection
  // (so closing and reopening the panel keeps you connected).
  useEffect(() => {
    if (!open) return
    void refreshConnections()
    let cancelled = false
    window.api.db
      .activeConnections()
      .then((list) => {
        if (cancelled || list.length === 0) return
        setActive((current) => {
          if (current) return current
          const first = list[0]
          const result: DbConnectResult = {
            connectionId: first.connectionId,
            serverVersion: '',
            database: first.database,
            user: first.user,
            host: first.host
          }
          void loadSchemas(first.connectionId)
          return result
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, refreshConnections, loadSchemas])

  return {
    connections,
    active,
    schemas,
    schema,
    tables,
    selected,
    connecting,
    setSchema,
    setSelected,
    refreshConnections,
    refreshTables,
    connectSaved,
    connectInline,
    saveConnection,
    deleteConnection,
    disconnect
  }
}
