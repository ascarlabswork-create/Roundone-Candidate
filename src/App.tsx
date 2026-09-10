import { AppRouter } from './app/router.tsx'
import { AppProviders } from './state/providers.tsx'

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}
