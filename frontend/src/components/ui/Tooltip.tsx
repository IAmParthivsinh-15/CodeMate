import { useId, type ReactNode } from 'react'

/** Lightweight CSS tooltip, shown on hover and on keyboard focus. */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-60 -translate-x-1/2 rounded-md bg-fg px-2 py-1 text-xs text-bg opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {content}
      </span>
    </span>
  )
}
