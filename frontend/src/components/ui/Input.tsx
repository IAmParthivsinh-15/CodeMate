import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export const fieldClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-fg placeholder:text-subtle ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 aria-invalid:border-danger'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  error?: string
  hint?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, className, id, ...rest }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(fieldClass, 'h-10', className)}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, className, id, ...rest }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium">
          {label}
        </label>
      )}
      <textarea ref={ref} id={inputId} className={cn(fieldClass, 'min-h-20 py-2', className)} {...rest} />
    </div>
  )
})
