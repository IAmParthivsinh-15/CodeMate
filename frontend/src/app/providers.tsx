import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ToastProvider } from '../components/ui/Toast'
import { AuthProvider } from '../features/auth/AuthProvider'
import { createQueryClient } from './queryClient'
import { SocketProvider } from './SocketProvider'
import { ThemeProvider } from './ThemeProvider'

/** All app-wide providers, in dependency order. */
export function AppProviders({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
