import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { ToastContext, type ToastApi, type ToastInput, type ToastTone } from './toastContext'

interface ToastItem extends Required<Omit<ToastInput, 'title'>> {
  id: number
  title?: string
}

const toneClass: Record<ToastTone, string> = {
  info: 'border-l-info',
  success: 'border-l-success',
  error: 'border-l-danger',
  warning: 'border-l-warning',
}

const icons: Record<ToastTone, string> = { info: 'ℹ', success: '✓', error: '⚠', warning: '!' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const show = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++
      const item: ToastItem = { id, title: t.title, message: t.message, tone: t.tone ?? 'info', durationMs: t.durationMs ?? 5000 }
      // Collapse identical consecutive messages (e.g. a burst of the same error).
      setItems((xs) => [...xs.filter((x) => x.message !== item.message).slice(-3), item])
      window.setTimeout(() => dismiss(id), item.durationMs)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, title) => show({ message, title, tone: 'success' }),
      error: (message, title) => show({ message, title, tone: 'error', durationMs: 7000 }),
      info: (message, title) => show({ message, title, tone: 'info' }),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'animate-slide-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-l-4 border-line bg-surface px-4 py-3 shadow-lg',
              toneClass[t.tone],
            )}
          >
            <span aria-hidden="true" className="mt-0.5 text-sm">
              {icons[t.tone]}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              {t.title && <p className="font-medium">{t.title}</p>}
              <p className="break-words text-muted">{t.message}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-subtle hover:text-fg"
              onClick={() => dismiss(t.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
