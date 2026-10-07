import { createContext, useContext } from 'react'

export type ToastTone = 'info' | 'success' | 'error' | 'warning'

export interface ToastInput {
  title?: string
  message: string
  tone?: ToastTone
  durationMs?: number
}

export interface ToastApi {
  show: (t: ToastInput) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
