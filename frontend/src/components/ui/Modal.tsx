import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/cn'
import { Button, type ButtonVariant } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Prevent closing via Esc / backdrop (e.g. while a request is running). */
  dismissible?: boolean
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

/** Accessible modal dialog: focus is moved in, trapped, and restored on close. */
export function Modal({ open, onClose, title, children, footer, size = 'md', dismissible = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  const dismissRef = useRef(dismissible)
  useEffect(() => {
    closeRef.current = onClose
    dismissRef.current = dismissible
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissRef.current) {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (items.length === 0) return
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="animate-fade-in absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'animate-slide-up relative flex max-h-[90vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-m-1 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg"
            >
              ✕
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmModalProps {
  open: boolean
  title: ReactNode
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: ButtonVariant
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Replacement for window.confirm. */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">{message}</div>
    </Modal>
  )
}
