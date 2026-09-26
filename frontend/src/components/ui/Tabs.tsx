import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface TabsProps<T extends string> {
  tabs: { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
  className?: string
  ariaLabel?: string
}

/** Accessible tab list (arrow keys move between tabs). Render the panel yourself. */
export function Tabs<T extends string>({ tabs, value, onChange, className, ariaLabel }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    if (next >= 0) {
      e.preventDefault()
      onChange(tabs[next].value)
      refs.current[next]?.focus()
    }
  }
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1', className)}>
      {tabs.map((t, i) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              active ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
