// Central, stable list of IPC channel names shared by main and preload.
export const IPC = {
  // File system
  SELECT_FOLDER: 'fs:selectFolder',
  CREATE_FOLDER_DIALOG: 'fs:createFolderDialog',
  READ_DIR: 'fs:readDir',
  READ_FILE: 'fs:readFile',
  READ_FILE_BASE64: 'fs:readFileBase64',
  WRITE_FILE: 'fs:writeFile',
  CREATE_FILE: 'fs:createFile',
  CREATE_FOLDER: 'fs:createFolder',
  DELETE_PATH: 'fs:deletePath',
  RENAME_PATH: 'fs:renamePath',
  WATCH_DIR: 'fs:watchDir',
  FS_CHANGED: 'fs:changed',
  REVEAL_PATH: 'fs:reveal',
  COPY_TEXT: 'fs:copyText',
  LIST_FILES: 'fs:listFiles',
  GIT_STATUS: 'fs:gitStatus',
  GIT_OVERVIEW: 'fs:gitOverview',
  GIT_DIFF: 'fs:gitDiff',
  GIT_COMMIT_DIFF: 'fs:gitCommitDiff',
  GIT_FILE_SIDES: 'fs:gitFileSides',
  GIT_FETCH: 'fs:gitFetch',
  GIT_COMMIT: 'fs:gitCommit',
  GIT_PUSH: 'fs:gitPush',
  GIT_PULL: 'fs:gitPull',
  GIT_BRANCHES: 'fs:gitBranches',
  GIT_CHECKOUT: 'fs:gitCheckout',
  GIT_CREATE_BRANCH: 'fs:gitCreateBranch',
  GIT_CLONE: 'fs:gitClone',
  GIT_CLONE_PROGRESS: 'fs:gitCloneProgress',

  // AI usage limits
  AI_LIMITS_GET: 'aiLimits:get',

  // PostgreSQL panel
  DB_LIST_CONNECTIONS: 'db:listConnections',
  DB_SAVE_CONNECTION: 'db:saveConnection',
  DB_DELETE_CONNECTION: 'db:deleteConnection',
  DB_CONNECT: 'db:connect',
  DB_DISCONNECT: 'db:disconnect',
  DB_ACTIVE_CONNECTIONS: 'db:activeConnections',
  DB_LIST_SCHEMAS: 'db:listSchemas',
  DB_LIST_TABLES: 'db:listTables',
  DB_GET_COLUMNS: 'db:getColumns',
  DB_GET_INDEXES: 'db:getIndexes',
  DB_GET_ROWS: 'db:getRows',
  DB_RUN_QUERY: 'db:runQuery',
  DB_INSERT_ROW: 'db:insertRow',
  DB_UPDATE_ROW: 'db:updateRow',
  DB_DELETE_ROW: 'db:deleteRow',
  DB_CREATE_TABLE: 'db:createTable',
  DB_DROP_TABLE: 'db:dropTable',
  DB_TRUNCATE_TABLE: 'db:truncateTable',
  DB_ADD_COLUMN: 'db:addColumn',
  DB_DROP_COLUMN: 'db:dropColumn',
  DB_CREATE_INDEX: 'db:createIndex',
  DB_DROP_INDEX: 'db:dropIndex',

  // Terminal
  CREATE_TERMINAL: 'term:create',
  RESTART_TERMINAL: 'term:restart',
  WRITE_TERMINAL: 'term:write',
  RESIZE_TERMINAL: 'term:resize',
  KILL_TERMINAL: 'term:kill',
  TERMINAL_DATA: 'term:data',
  TERMINAL_EXIT: 'term:exit',

  // Window controls (custom title bar)
  WINDOW_MINIMIZE: 'win:minimize',
  WINDOW_MAXIMIZE_TOGGLE: 'win:maximizeToggle',
  WINDOW_CLOSE: 'win:close',
  WINDOW_MAXIMIZED: 'win:maximized',

  // Close confirmation (unsaved-changes guard)
  APP_CONFIRM_CLOSE: 'app:confirmClose',
  APP_DO_CLOSE: 'app:doClose',

  // Auto update
  UPDATE_GET_STATUS: 'update:getStatus',
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS: 'update:status'
} as const
