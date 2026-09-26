import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface SplitPaneProps {
  /** horizontal = side by side (vertical divider); vertical = stacked (horizontal divider). */
  direction: 'horizontal' | 'vertical'
  first: ReactNode
  second: ReactNode
  /** Initial size of the first pane, in percent. */
  initial?: number
  min?: number
  max?: number
  /** Remember the size in localStorage under this key. */
  storageKey?: string
  className?: string
  label?: string
}

const readSize = (key: string | undefined, fallback: number) => {
  if (!key) return fallback
  try {
    const v = Number(localStorage.getItem(key))
    return Number.isFinite(v) && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

/** Two resizable panes with a draggable, keyboard-accessible divider. */
export function SplitPane({ direction, first, second, initial = 50, min = 20, max = 80, storageKey, className, label = 'Resize panels' }: SplitPaneProps) {
  const [size, setSize] = useState(() => readSize(storageKey, initial))
  const container = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const horizontal = direction === 'horizontal'
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max])

  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, String(Math.round(size * 10) / 10))
    } catch {
      // storage unavailable
    }
  }, [size, storageKey])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.userSelect = 'none'
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !container.current) return
    const r = container.current.getBoundingClientRect()
    const pct = horizontal ? ((e.clientX - r.left) / r.width) * 100 : ((e.clientY - r.top) / r.height) * 100
    setSize(clamp(pct))
  }
  const stop = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    document.body.style.userSelect = ''
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dec = horizontal ? 'ArrowLeft' : 'ArrowUp'
    const inc = horizontal ? 'ArrowRight' : 'ArrowDown'
    if (e.key === dec) setSize((s) => clamp(s - 2))
    else if (e.key === inc) setSize((s) => clamp(s + 2))
    else return
    e.preventDefault()
  }

  return (
    <div ref={container} className={cn('flex min-h-0 min-w-0', horizontal ? 'flex-row' : 'flex-col', className)}>
      <div className="min-h-0 min-w-0 overflow-hidden" style={{ flexBasis: `${size}%`, flexShrink: 0, flexGrow: 0 }}>
        {first}
      </div>
      <div
        role="separator"
        aria-label={label}
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        aria-valuenow={Math.round(size)}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={onKeyDown}
        className={cn(
          'group relative shrink-0 touch-none outline-none',
          horizontal ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize',
        )}
      >
        <span
          className={cn(
            'absolute rounded-full bg-line transition-colors group-hover:bg-primary group-focus-visible:bg-primary',
            horizontal ? 'inset-y-2 left-1/2 w-0.5 -translate-x-1/2' : 'inset-x-2 top-1/2 h-0.5 -translate-y-1/2',
          )}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  )
}
