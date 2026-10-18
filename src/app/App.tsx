import { ErrorBoundary } from './ErrorBoundary.tsx'
import { Providers } from './Providers.tsx'
import { AppRouter } from './Router.tsx'

export function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <AppRouter />
      </Providers>
    </ErrorBoundary>
  )
}
