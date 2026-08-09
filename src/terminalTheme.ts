import type { ITheme } from '@xterm/xterm'
import type { ThemeName } from './types'

// Tokyo Night (dark) / Tokyo Night Day (light) — the same family the app chrome
// uses, so the terminal follows the selected theme instead of staying dark.
const DARK: ITheme = {
  background: '#15161e',
  foreground: '#c0caf5',
  cursor: '#c0caf5',
  cursorAccent: '#15161e',
  selectionBackground: '#28344a',
  black: '#15161e',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#a9b1d6',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5'
}

const LIGHT: ITheme = {
  background: '#eef0f4',
  foreground: '#343b58',
  cursor: '#3760bf',
  cursorAccent: '#eef0f4',
  selectionBackground: '#c4cbe8',
  black: '#4c505e',
  red: '#c14a5e',
  green: '#587539',
  yellow: '#8c6c3e',
  blue: '#2e7de9',
  magenta: '#9854f1',
  cyan: '#007197',
  white: '#6172b0',
  brightBlack: '#8990b3',
  brightRed: '#f52a65',
  brightGreen: '#587539',
  brightYellow: '#8c6c3e',
  brightBlue: '#2e7de9',
  brightMagenta: '#9854f1',
  brightCyan: '#007197',
  brightWhite: '#3760bf'
}

export function terminalTheme(theme: ThemeName): ITheme {
  return theme === 'light' ? LIGHT : DARK
}
