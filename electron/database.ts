import {
  app,
  safeStorage,
  type IpcMain,
  type IpcMainInvokeEvent
} from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { Pool as PgPool, PoolConfig, QueryArrayResult } from 'pg'
import { IPC } from './ipcChannels'
import { assertTrustedIpcSender } from './security'
import type {
  DbActiveConnection,
  DbColumn,
  DbColumnDef,
  DbConnectResult,
  DbConnectionInput,
  DbIndex,
  DbResultSet,
  DbRowsResult,
  DbTable,
  SavedDbConnection
} from '../src/types'

// Load pg lazily, mirroring node-pty: the app still launches if the module is
// somehow missing; the error only surfaces when the DB panel is actually used.
type PgModule = typeof import('pg')
let pgLib: PgModule | null = null
async function getPg(): Promise<PgModule> {
  if (!pgLib) {
    try {
      pgLib = await import('pg')
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new Error(`PostgreSQL sürücüsü (pg) yüklenemedi. Detay: ${detail}`)
    }
  }
  return pgLib
}

// ---- Encrypted connection store (safeStorage / Windows DPAPI) ----

interface StoredConnection extends DbConnectionInput {
  id: string
}

const STORE_DIR = 'databases'
const STORE_FILE = 'connections.enc'

function storePath(): string {
  return path.join(app.getPath('userData'), STORE_DIR, STORE_FILE)
}

let storeCache: StoredConnection[] | null = null

function loadStored(): StoredConnection[] {
  if (storeCache) return storeCache
  try {
    const file = storePath()
    if (!existsSync(file)) {
      storeCache = []
      return storeCache
    }
    const encrypted = readFileSync(file)
    const json = safeStorage.decryptString(encrypted)
    const parsed = JSON.parse(json) as unknown
    storeCache = Array.isArray(parsed) ? (parsed as StoredConnection[]) : []
  } catch {
    storeCache = []
  }
  return storeCache
}

function persistStored(list: StoredConnection[]): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Bu sistemde şifreli saklama kullanılamıyor; bağlantı kaydedilemez.')
  }
  storeCache = list
  const dir = path.join(app.getPath('userData'), STORE_DIR)
  mkdirSync(dir, { recursive: true })
  const encrypted = safeStorage.encryptString(JSON.stringify(list))
  writeFileSync(storePath(), encrypted)
}

function sanitize(conn: StoredConnection): SavedDbConnection {
  return {
    id: conn.id,
    label: conn.label,
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.user,
    ssl: conn.ssl,
    hasPassword: !!conn.password
  }
}

function normalizeInput(input: DbConnectionInput): DbConnectionInput {
  const host = String(input.host || '').trim()
  const database = String(input.database || '').trim()
  const user = String(input.user || '').trim()
  if (!host) throw new Error('Sunucu (host) gerekli')
  if (!database) throw new Error('Veritabanı adı gerekli')
  if (!user) throw new Error('Kullanıcı adı gerekli')
  const port = Number(input.port)
  return {
    label: String(input.label || '').trim() || `${user}@${host}`,
    host,
    port: Number.isFinite(port) && port > 0 ? Math.floor(port) : 5432,
    database,
    user,
    password: typeof input.password === 'string' ? input.password : '',
    ssl: !!input.ssl
  }
}

// ---- Live connection pools ----

interface LiveConnection {
  pool: PgPool
  meta: DbActiveConnection
}

const live = new Map<string, LiveConnection>()

function getConn(connectionId: string): LiveConnection {
  const conn = live.get(connectionId)
  if (!conn) throw new Error('Bağlantı bulunamadı veya kapatılmış')
  return conn
}

async function openConnection(config: DbConnectionInput): Promise<DbConnectResult> {
  const pg = await getPg()
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 4,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  }
  const pool = new pg.Pool(poolConfig)
  try {
    const result = await pool.query<{ server_version: string }>('SHOW server_version')
    const serverVersion = result.rows[0]?.server_version ?? 'unknown'
    const connectionId = randomUUID()
    const meta: DbActiveConnection = {
      connectionId,
      label: config.label,
      database: config.database,
      user: config.user,
      host: config.host
    }
    live.set(connectionId, { pool, meta })
    return {
      connectionId,
      serverVersion,
      database: config.database,
      user: config.user,
      host: config.host
    }
  } catch (err) {
    await pool.end().catch(() => {})
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Bağlantı kurulamadı: ${detail}`)
  }
}

// ---- SQL identifier quoting + value serialization ----

// Quote an identifier (schema/table/column/index name) for safe interpolation.
// Identifiers can't be passed as bind parameters, so this is the only safe path.
function quoteIdent(name: string): string {
  if (typeof name !== 'string' || name.includes('\0')) {
    throw new Error('Geçersiz tanımlayıcı')
  }
  return `"${name.replace(/"/g, '""')}"`
}

function qualified(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`
}

// Serialize any pg cell value to a renderer-friendly string (or null).
function cell(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return `\\x${value.toString('hex')}`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function toResultSet(result: QueryArrayResult, durationMs: number): DbResultSet {
  const columns = result.fields.map((f) => f.name)
  const rows = (result.rows as unknown[][]).map((row) => row.map(cell))
  return {
    columns,
    rows,
    rowCount: result.rowCount ?? rows.length,
    command: result.command ?? '',
    durationMs
  }
}

// Run a (single-statement) parameterized query in array row mode.
async function queryArray(
  connectionId: string,
  text: string,
  values: unknown[] = []
): Promise<QueryArrayResult> {
  const { pool } = getConn(connectionId)
  return pool.query<unknown[]>({ text, values, rowMode: 'array' })
}

// ---- Schema / table introspection ----

async function listSchemas(connectionId: string): Promise<string[]> {
  const { pool } = getConn(connectionId)
  const res = await pool.query<{ schema_name: string }>(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT LIKE 'pg\\_%' AND schema_name <> 'information_schema'
     ORDER BY schema_name`
  )
  return res.rows.map((r) => r.schema_name)
}

async function listTables(connectionId: string, schema: string): Promise<DbTable[]> {
  const { pool } = getConn(connectionId)
  const res = await pool.query<{ name: string; kind: string; est: string | null }>(
    `SELECT c.relname AS name,
            CASE WHEN c.relkind IN ('v','m') THEN 'view' ELSE 'table' END AS kind,
            CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END AS est
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relkind IN ('r','v','m','p')
     ORDER BY c.relname`,
    [schema]
  )
  return res.rows.map((r) => ({
    schema,
    name: r.name,
    kind: r.kind === 'view' ? 'view' : 'table',
    estimatedRows: r.est === null ? null : Number(r.est)
  }))
}

async function getColumns(
  connectionId: string,
  schema: string,
  table: string
): Promise<DbColumn[]> {
  const { pool } = getConn(connectionId)
  const res = await pool.query<{
    column_name: string
    data_type: string
    is_nullable: boolean
    column_default: string | null
    is_pk: boolean
  }>(
    `SELECT a.attname AS column_name,
            format_type(a.atttypid, a.atttypmod) AS data_type,
            NOT a.attnotnull AS is_nullable,
            pg_get_expr(d.adbin, d.adrelid) AS column_default,
            COALESCE(bool_or(i.indisprimary), false) AS is_pk
     FROM pg_attribute a
     JOIN pg_class cl ON cl.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = cl.relnamespace
     LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     LEFT JOIN pg_index i ON i.indrelid = a.attrelid AND a.attnum = ANY(i.indkey) AND i.indisprimary
     WHERE n.nspname = $1 AND cl.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
     GROUP BY a.attname, a.atttypid, a.atttypmod, a.attnotnull, d.adbin, d.adrelid, a.attnum
     ORDER BY a.attnum`,
    [schema, table]
  )
  return res.rows.map((r) => ({
    name: r.column_name,
    dataType: r.data_type,
    nullable: r.is_nullable,
    default: r.column_default,
    isPrimaryKey: r.is_pk
  }))
}

async function getIndexes(
  connectionId: string,
  schema: string,
  table: string
): Promise<DbIndex[]> {
  const { pool } = getConn(connectionId)
  const res = await pool.query<{
    name: string
    definition: string
    is_primary: boolean
    is_unique: boolean
  }>(
    `SELECT i.relname AS name,
            pg_get_indexdef(ix.indexrelid) AS definition,
            ix.indisprimary AS is_primary,
            ix.indisunique AS is_unique
     FROM pg_index ix
     JOIN pg_class i ON i.oid = ix.indexrelid
     JOIN pg_class t ON t.oid = ix.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = $1 AND t.relname = $2
     ORDER BY i.relname`,
    [schema, table]
  )
  return res.rows.map((r) => ({
    name: r.name,
    definition: r.definition,
    isPrimary: r.is_primary,
    isUnique: r.is_unique
  }))
}

interface GetRowsOptions {
  limit: number
  offset: number
  orderBy?: string | null
  orderDir?: 'ASC' | 'DESC'
}

async function getRows(
  connectionId: string,
  schema: string,
  table: string,
  opts: GetRowsOptions
): Promise<DbRowsResult> {
  const columns = await getColumns(connectionId, schema, table)
  const columnNames = new Set(columns.map((c) => c.name))
  const primaryKey = columns.filter((c) => c.isPrimaryKey).map((c) => c.name)
  const limit = Math.max(1, Math.min(1000, Math.floor(opts.limit) || 100))
  const offset = Math.max(0, Math.floor(opts.offset) || 0)

  let orderClause = ''
  if (opts.orderBy && columnNames.has(opts.orderBy)) {
    const dir = opts.orderDir === 'DESC' ? 'DESC' : 'ASC'
    orderClause = ` ORDER BY ${quoteIdent(opts.orderBy)} ${dir}`
  }

  const start = Date.now()
  const dataRes = await queryArray(
    connectionId,
    `SELECT * FROM ${qualified(schema, table)}${orderClause} LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  const { pool } = getConn(connectionId)
  const countRes = await pool.query<{ total: string }>(
    `SELECT count(*)::bigint AS total FROM ${qualified(schema, table)}`
  )
  return {
    ...toResultSet(dataRes, Date.now() - start),
    total: Number(countRes.rows[0]?.total ?? 0),
    primaryKey
  }
}

// ---- Free-form SQL console ----

async function runQuery(connectionId: string, sql: string): Promise<DbResultSet> {
  const { pool } = getConn(connectionId)
  const text = String(sql || '').trim()
  if (!text) throw new Error('Boş sorgu')
  const start = Date.now()
  const raw = await pool.query<unknown[]>({ text, rowMode: 'array' })
  // Multiple statements may yield an array of results; show the last one.
  const result = (Array.isArray(raw) ? raw[raw.length - 1] : raw) as QueryArrayResult
  return toResultSet(result, Date.now() - start)
}

// ---- Row CRUD (requires a primary key) ----

function assertPk(pk: Record<string, string | null>): void {
  if (!pk || Object.keys(pk).length === 0) {
    throw new Error('Bu işlem için tabloda birincil anahtar (primary key) gerekli')
  }
}

async function insertRow(
  connectionId: string,
  schema: string,
  table: string,
  values: Record<string, string | null>
): Promise<void> {
  const entries = Object.entries(values)
  if (entries.length === 0) throw new Error('Eklenecek değer yok')
  const cols = entries.map(([c]) => quoteIdent(c)).join(', ')
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ')
  await queryArray(
    connectionId,
    `INSERT INTO ${qualified(schema, table)} (${cols}) VALUES (${placeholders})`,
    entries.map(([, v]) => v)
  )
}

async function updateRow(
  connectionId: string,
  schema: string,
  table: string,
  pk: Record<string, string | null>,
  changes: Record<string, string | null>
): Promise<void> {
  assertPk(pk)
  const changeEntries = Object.entries(changes)
  if (changeEntries.length === 0) return
  const pkEntries = Object.entries(pk)
  const setClause = changeEntries.map(([c], i) => `${quoteIdent(c)} = $${i + 1}`).join(', ')
  const whereClause = pkEntries
    .map(([c], i) => `${quoteIdent(c)} = $${changeEntries.length + i + 1}`)
    .join(' AND ')
  await queryArray(
    connectionId,
    `UPDATE ${qualified(schema, table)} SET ${setClause} WHERE ${whereClause}`,
    [...changeEntries.map(([, v]) => v), ...pkEntries.map(([, v]) => v)]
  )
}

async function deleteRow(
  connectionId: string,
  schema: string,
  table: string,
  pk: Record<string, string | null>
): Promise<void> {
  assertPk(pk)
  const pkEntries = Object.entries(pk)
  const whereClause = pkEntries.map(([c], i) => `${quoteIdent(c)} = $${i + 1}`).join(' AND ')
  await queryArray(
    connectionId,
    `DELETE FROM ${qualified(schema, table)} WHERE ${whereClause}`,
    pkEntries.map(([, v]) => v)
  )
}

// ---- DDL (structure editing) ----

// Build one column clause for CREATE TABLE / ADD COLUMN. `dataType` and
// `default` are raw SQL the user supplies (DDL can't be parameterized).
function columnClause(col: DbColumnDef): string {
  const type = String(col.dataType || '').trim()
  if (!type) throw new Error(`"${col.name}" için veri tipi gerekli`)
  let clause = `${quoteIdent(col.name)} ${type}`
  if (!col.nullable) clause += ' NOT NULL'
  const def = String(col.default || '').trim()
  if (def) clause += ` DEFAULT ${def}`
  return clause
}

async function createTable(
  connectionId: string,
  schema: string,
  name: string,
  columns: DbColumnDef[]
): Promise<void> {
  if (!columns || columns.length === 0) throw new Error('En az bir kolon gerekli')
  const defs = columns.map(columnClause)
  const pkCols = columns.filter((c) => c.primaryKey).map((c) => quoteIdent(c.name))
  if (pkCols.length > 0) defs.push(`PRIMARY KEY (${pkCols.join(', ')})`)
  await queryArray(
    connectionId,
    `CREATE TABLE ${qualified(schema, name)} (${defs.join(', ')})`
  )
}

async function dropTable(connectionId: string, schema: string, table: string): Promise<void> {
  await queryArray(connectionId, `DROP TABLE ${qualified(schema, table)}`)
}

async function truncateTable(
  connectionId: string,
  schema: string,
  table: string
): Promise<void> {
  await queryArray(connectionId, `TRUNCATE TABLE ${qualified(schema, table)}`)
}

async function addColumn(
  connectionId: string,
  schema: string,
  table: string,
  column: DbColumnDef
): Promise<void> {
  await queryArray(
    connectionId,
    `ALTER TABLE ${qualified(schema, table)} ADD COLUMN ${columnClause(column)}`
  )
}

async function dropColumn(
  connectionId: string,
  schema: string,
  table: string,
  column: string
): Promise<void> {
  await queryArray(
    connectionId,
    `ALTER TABLE ${qualified(schema, table)} DROP COLUMN ${quoteIdent(column)}`
  )
}

interface CreateIndexInput {
  name: string
  columns: string[]
  unique: boolean
}

async function createIndex(
  connectionId: string,
  schema: string,
  table: string,
  input: CreateIndexInput
): Promise<void> {
  if (!input.columns || input.columns.length === 0) {
    throw new Error('Index için en az bir kolon gerekli')
  }
  const cols = input.columns.map(quoteIdent).join(', ')
  const unique = input.unique ? 'UNIQUE ' : ''
  await queryArray(
    connectionId,
    `CREATE ${unique}INDEX ${quoteIdent(input.name)} ON ${qualified(schema, table)} (${cols})`
  )
}

async function dropIndex(connectionId: string, schema: string, name: string): Promise<void> {
  await queryArray(connectionId, `DROP INDEX ${qualified(schema, name)}`)
}

// ---- IPC registration ----

export function registerDatabaseHandlers(ipcMain: IpcMain): void {
  const handle = (
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown
  ): void => {
    ipcMain.handle(channel, async (event, ...args) => {
      assertTrustedIpcSender(event)
      return listener(event, ...args)
    })
  }

  handle(IPC.DB_LIST_CONNECTIONS, () => loadStored().map(sanitize))

  handle(IPC.DB_SAVE_CONNECTION, (_e, input: DbConnectionInput, id?: string) => {
    const normalized = normalizeInput(input)
    const list = [...loadStored()]
    // Without an explicit id, treat same host+port+database+user as the same
    // connection so connecting repeatedly upserts instead of piling up dupes.
    const idx = id
      ? list.findIndex((c) => c.id === id)
      : list.findIndex(
          (c) =>
            c.host === normalized.host &&
            c.port === normalized.port &&
            c.database === normalized.database &&
            c.user === normalized.user
        )
    if (idx >= 0) {
      // Keep the existing password when the form leaves it blank.
      const password = normalized.password || list[idx].password
      list[idx] = { ...normalized, password, id: list[idx].id }
    } else {
      list.push({ ...normalized, id: id || randomUUID() })
    }
    persistStored(list)
    return list.map(sanitize)
  })

  handle(IPC.DB_DELETE_CONNECTION, (_e, id: string) => {
    persistStored(loadStored().filter((c) => c.id !== id))
    return loadStored().map(sanitize)
  })

  handle(
    IPC.DB_CONNECT,
    (_e, payload: { savedId?: string; input?: DbConnectionInput }) => {
      if (payload.savedId) {
        const saved = loadStored().find((c) => c.id === payload.savedId)
        if (!saved) throw new Error('Kayıtlı bağlantı bulunamadı')
        return openConnection(saved)
      }
      if (!payload.input) throw new Error('Bağlantı bilgisi eksik')
      return openConnection(normalizeInput(payload.input))
    }
  )

  handle(IPC.DB_DISCONNECT, async (_e, connectionId: string) => {
    const conn = live.get(connectionId)
    if (conn) {
      live.delete(connectionId)
      await conn.pool.end().catch(() => {})
    }
  })

  handle(IPC.DB_ACTIVE_CONNECTIONS, (): DbActiveConnection[] =>
    [...live.values()].map((c) => c.meta)
  )

  handle(IPC.DB_LIST_SCHEMAS, (_e, connectionId: string) => listSchemas(connectionId))
  handle(IPC.DB_LIST_TABLES, (_e, connectionId: string, schema: string) =>
    listTables(connectionId, schema)
  )
  handle(IPC.DB_GET_COLUMNS, (_e, connectionId: string, schema: string, table: string) =>
    getColumns(connectionId, schema, table)
  )
  handle(IPC.DB_GET_INDEXES, (_e, connectionId: string, schema: string, table: string) =>
    getIndexes(connectionId, schema, table)
  )
  handle(
    IPC.DB_GET_ROWS,
    (_e, connectionId: string, schema: string, table: string, opts: GetRowsOptions) =>
      getRows(connectionId, schema, table, opts)
  )
  handle(IPC.DB_RUN_QUERY, (_e, connectionId: string, sql: string) =>
    runQuery(connectionId, sql)
  )

  handle(
    IPC.DB_INSERT_ROW,
    (_e, connectionId: string, schema: string, table: string, values: Record<string, string | null>) =>
      insertRow(connectionId, schema, table, values)
  )
  handle(
    IPC.DB_UPDATE_ROW,
    (
      _e,
      connectionId: string,
      schema: string,
      table: string,
      pk: Record<string, string | null>,
      changes: Record<string, string | null>
    ) => updateRow(connectionId, schema, table, pk, changes)
  )
  handle(
    IPC.DB_DELETE_ROW,
    (_e, connectionId: string, schema: string, table: string, pk: Record<string, string | null>) =>
      deleteRow(connectionId, schema, table, pk)
  )

  handle(
    IPC.DB_CREATE_TABLE,
    (_e, connectionId: string, schema: string, name: string, columns: DbColumnDef[]) =>
      createTable(connectionId, schema, name, columns)
  )
  handle(IPC.DB_DROP_TABLE, (_e, connectionId: string, schema: string, table: string) =>
    dropTable(connectionId, schema, table)
  )
  handle(IPC.DB_TRUNCATE_TABLE, (_e, connectionId: string, schema: string, table: string) =>
    truncateTable(connectionId, schema, table)
  )
  handle(
    IPC.DB_ADD_COLUMN,
    (_e, connectionId: string, schema: string, table: string, column: DbColumnDef) =>
      addColumn(connectionId, schema, table, column)
  )
  handle(
    IPC.DB_DROP_COLUMN,
    (_e, connectionId: string, schema: string, table: string, column: string) =>
      dropColumn(connectionId, schema, table, column)
  )
  handle(
    IPC.DB_CREATE_INDEX,
    (_e, connectionId: string, schema: string, table: string, input: CreateIndexInput) =>
      createIndex(connectionId, schema, table, input)
  )
  handle(IPC.DB_DROP_INDEX, (_e, connectionId: string, schema: string, name: string) =>
    dropIndex(connectionId, schema, name)
  )
}

// Close every live pool (called on app shutdown).
export function closeAllDatabaseConnections(): void {
  for (const conn of live.values()) {
    conn.pool.end().catch(() => {})
  }
  live.clear()
}
