import { useEffect, useReducer, useRef, type ReactNode } from 'react'

interface SplitLayoutProps {
  direction: 'horizontal' | 'vertical'
  /** Initial size (px) of the anchored pane. */
  initial: number
  min?: number
  /**
   * Which pane keeps a fixed (draggable) size; the other flexes to fill. Default
   * 'first'. Use 'second' to pin a right/bottom sidebar so it stays put when the
   * window resizes instead of growing to eat the screen.
   */
  anchor?: 'first' | 'second'
  children: [ReactNode, ReactNode]
}

// A two-pane resizable layout with a draggable divider between the children.
export function SplitLayout({
  direction,
  initial,
  min = 150,
  anchor = 'first',
  children
}: SplitLayoutProps) {
  const [size, setSize] = useReducer((_size: number, nextSize: number) => nextSize, initial)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const isHorizontal = direction === 'horizontal'
  const layoutRef = useRef({ isHorizontal, min, anchor })
  layoutRef.current = { isHorizontal, min, anchor }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const { isHorizontal: horizontal, min: minSize, anchor: side } = layoutRef.current
      const rect = containerRef.current.getBoundingClientRect()
      // Measure from the edge the anchored pane hugs.
      const raw =
        side === 'first'
          ? horizontal
            ? e.clientX - rect.left
            : e.clientY - rect.top
          : horizontal
            ? rect.right - e.clientX
            : rect.bottom - e.clientY
      const total = horizontal ? rect.width : rect.height
      const clamped = Math.max(minSize, Math.min(raw, total - minSize))
      setSize(clamped)
    }

    const stopDrag = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', stopDrag)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', stopDrag)
      stopDrag()
    }
  }, [])

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }

  const sizeStyle = isHorizontal ? { width: size } : { height: size }

  return (
    <div ref={containerRef} className={`split split-${direction}`}>
      <div
        className={`split-pane ${anchor === 'first' ? 'split-fixed' : 'split-flex'}`}
        style={anchor === 'first' ? sizeStyle : undefined}
      >
        {children[0]}
      </div>
      <button
        type="button"
        className={`split-divider split-divider-${direction}`}
        aria-label={isHorizontal ? 'Panelleri yatay yeniden boyutlandır' : 'Panelleri dikey yeniden boyutlandır'}
        onMouseDown={startDrag}
      />
      <div
        className={`split-pane ${anchor === 'second' ? 'split-fixed' : 'split-flex'}`}
        style={anchor === 'second' ? sizeStyle : undefined}
      >
        {children[1]}
      </div>
    </div>
  )
}
