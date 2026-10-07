import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'
import { fieldClass } from './Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  options: { value: string; label: string }[]
}

export function Select({ label, options, className, id, ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium">
          {label}
        </label>
      )}
      <select id={selectId} className={cn(fieldClass, 'h-10 pr-8', className)} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
