import { BrowserRouter } from 'react-router'
import { ErrorBoundary } from '../components/layout/ErrorBoundary'
import { OfflineBanner } from '../components/layout/OfflineBanner'
import { AppProviders } from './providers'
import { AppRoutes } from './router'

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProviders>
          <OfflineBanner />
          <AppRoutes />
        </AppProviders>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
