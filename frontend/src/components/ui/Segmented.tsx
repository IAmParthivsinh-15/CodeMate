import { useId, type ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface SegmentedProps<T extends string> {
  label: ReactNode
  value: T
  options: { value: T; label: ReactNode; hint?: ReactNode }[]
  onChange: (v: T) => void
  className?: string
  columns?: number
}

/** Radio group styled as selectable tiles. Arrow keys work natively. */
export function Segmented<T extends string>({ label, value, options, onChange, className, columns }: SegmentedProps<T>) {
  const name = useId()
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const checked = o.value === value
          return (
            <label
              key={o.value}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-lg border px-2 py-2 text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                checked ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface hover:bg-surface-2',
              )}
            >
              <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              <span className="font-medium">{o.label}</span>
              {o.hint && <span className={cn('text-xs', checked ? 'text-primary' : 'text-muted')}>{o.hint}</span>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
