import type { ReactNode } from 'react'
import { Logo } from '../../components/layout/Logo'
import { ThemeToggle } from '../../components/layout/ThemeToggle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  useDocumentTitle(title)
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>
          <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">{children}</div>
          <p className="mt-5 text-center text-sm text-muted">{footer}</p>
        </div>
      </main>
    </div>
  )
}
