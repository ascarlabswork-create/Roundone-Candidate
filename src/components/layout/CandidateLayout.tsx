import { Outlet } from 'react-router-dom'
import { useToast } from '../../state/toast.tsx'
import { Footer } from './Footer.tsx'
import { Navbar } from './Navbar.tsx'

export function CandidateLayout() {
  const { toasts, dismissToast } = useToast()

  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className="pointer-events-auto rounded-lg bg-navy-950 px-4 py-3 text-left text-sm text-white shadow-lg"
            onClick={() => dismissToast(toast.id)}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </div>
  )
}
