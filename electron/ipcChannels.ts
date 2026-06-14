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
