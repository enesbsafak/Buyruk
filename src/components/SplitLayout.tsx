import { useEffect, useReducer, useRef, type ReactNode } from 'react'

interface SplitLayoutProps {
  direction: 'horizontal' | 'vertical'
  /** Initial size (px) of the first pane. */
  initial: number
  min?: number
  children: [ReactNode, ReactNode]
}

// A two-pane resizable layout with a draggable divider between the children.
export function SplitLayout({ direction, initial, min = 150, children }: SplitLayoutProps) {
  const [size, setSize] = useReducer((_size: number, nextSize: number) => nextSize, initial)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const isHorizontal = direction === 'horizontal'
  const layoutRef = useRef({ isHorizontal, min })
  layoutRef.current = { isHorizontal, min }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const { isHorizontal: horizontal, min: minSize } = layoutRef.current
      const rect = containerRef.current.getBoundingClientRect()
      const raw = horizontal ? e.clientX - rect.left : e.clientY - rect.top
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
    }
  }, [])

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div ref={containerRef} className={`split split-${direction}`}>
      <div
        className="split-pane split-first"
        style={isHorizontal ? { width: size } : { height: size }}
      >
        {children[0]}
      </div>
      <button
        type="button"
        className={`split-divider split-divider-${direction}`}
        aria-label={isHorizontal ? 'Panelleri yatay yeniden boyutlandır' : 'Panelleri dikey yeniden boyutlandır'}
        onMouseDown={startDrag}
      />
      <div className="split-pane split-second">{children[1]}</div>
    </div>
  )
}
