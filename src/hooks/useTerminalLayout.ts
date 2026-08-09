import { useCallback, useMemo, useState } from 'react'
import {
  loadTerminalLayout,
  saveTerminalLayout,
  type TerminalLayout,
  type TerminalLayoutMode
} from '../utils/persistence'

const MIN_FRACTION = 0.2

function sized(fractions: number[], count: number): number[] {
  return fractions.length === count ? fractions : Array.from({ length: count }, () => 1)
}

function cumulativeRatio(fractions: number[], index: number): number {
  const total = fractions.reduce((sum, value) => sum + value, 0)
  const upTo = fractions.slice(0, index + 1).reduce((sum, value) => sum + value, 0)
  return total > 0 ? upTo / total : 0
}

// Move the boundary after `index` to `ratio` (0..1 of the whole track), keeping
// every other track untouched by only redistributing the adjacent pair.
function resizeAt(fractions: number[], index: number, ratio: number): number[] {
  const total = fractions.reduce((sum, value) => sum + value, 0)
  const before = fractions.slice(0, index).reduce((sum, value) => sum + value, 0)
  const pairTotal = fractions[index] + fractions[index + 1]
  const target = ratio * total - before
  const clamped = Math.max(MIN_FRACTION, Math.min(pairTotal - MIN_FRACTION, target))
  const next = [...fractions]
  next[index] = clamped
  next[index + 1] = pairTotal - clamped
  return next
}

export interface TerminalGrid {
  mode: TerminalLayoutMode
  columns: number
  cols: number
  rows: number
  colFractions: number[]
  rowFractions: number[]
  /** 0..1 offsets of each draggable boundary. */
  colBoundaries: number[]
  rowBoundaries: number[]
}

export function useTerminalLayout(paneCount: number) {
  const [layout, setLayout] = useState<TerminalLayout>(loadTerminalLayout)

  const commit = useCallback((next: TerminalLayout) => {
    setLayout(next)
    saveTerminalLayout(next)
  }, [])

  const grid = useMemo<TerminalGrid>(() => {
    const count = Math.max(1, paneCount)
    const cols =
      layout.mode === 'tabs'
        ? 1
        : layout.columns > 0
          ? Math.min(layout.columns, count)
          : Math.ceil(Math.sqrt(count))
    const rows = layout.mode === 'tabs' ? 1 : Math.ceil(count / cols)
    const colFractions = sized(layout.colFractions, cols)
    const rowFractions = sized(layout.rowFractions, rows)
    return {
      mode: layout.mode,
      columns: layout.columns,
      cols,
      rows,
      colFractions,
      rowFractions,
      colBoundaries: colFractions
        .slice(0, -1)
        .map((_, index) => cumulativeRatio(colFractions, index)),
      rowBoundaries: rowFractions
        .slice(0, -1)
        .map((_, index) => cumulativeRatio(rowFractions, index))
    }
  }, [layout, paneCount])

  const setMode = useCallback(
    (mode: TerminalLayoutMode) => commit({ ...layout, mode }),
    [commit, layout]
  )

  // Changing the column count invalidates both tracks, so reset them to equal.
  const setColumns = useCallback(
    (columns: number) =>
      commit({ ...layout, columns, colFractions: [], rowFractions: [] }),
    [commit, layout]
  )

  const dragColumn = useCallback(
    (index: number, ratio: number) => {
      const current = sized(layout.colFractions, grid.cols)
      commit({ ...layout, colFractions: resizeAt(current, index, ratio) })
    },
    [commit, grid.cols, layout]
  )

  const dragRow = useCallback(
    (index: number, ratio: number) => {
      const current = sized(layout.rowFractions, grid.rows)
      commit({ ...layout, rowFractions: resizeAt(current, index, ratio) })
    },
    [commit, grid.rows, layout]
  )

  const resetSizes = useCallback(
    () => commit({ ...layout, colFractions: [], rowFractions: [] }),
    [commit, layout]
  )

  return { grid, setMode, setColumns, dragColumn, dragRow, resetSizes }
}
