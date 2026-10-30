import { Outlet } from 'react-router-dom'
import { useNotifications } from '../../state/notifications.tsx'
import { useSession } from '../../state/session.tsx'
import { useToast } from '../../state/toast.tsx'
import { AuthModal } from '../auth/AuthModal.tsx'
import { Footer } from './Footer.tsx'
import { Navbar, SignedInDesktopBar } from './Navbar.tsx'
import { Sidebar } from './Sidebar.tsx'

export function CandidateLayout() {
  const { toasts, dismissToast } = useToast()
  const { account, status, signOut } = useSession()
  const { unreadCount } = useNotifications()
  const signedIn = status === 'authenticated' && Boolean(account)
  const unreadBadge = unreadCount != null && unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null

  return (
    <div className={signedIn ? 'flex min-h-svh studio-grid' : 'flex min-h-svh flex-col public-surface'}>
      {signedIn ? (
        <div className="sticky top-0 hidden h-svh lg:flex">
          <Sidebar unreadBadge={unreadBadge} onSignOut={() => void signOut()} />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        {signedIn ? <SignedInDesktopBar /> : null}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      <AuthModal />
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className="pointer-events-auto rounded-xl bg-navy-950 px-4 py-3 text-left text-sm text-white shadow-lg"
            onClick={() => dismissToast(toast.id)}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </div>
  )
}
