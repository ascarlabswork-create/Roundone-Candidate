import { Bell, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'
import { useAuthModal } from '../../state/authModal.tsx'
import { useNotifications } from '../../state/notifications.tsx'
import { useSession } from '../../state/session.tsx'
import { Button } from '../ui/Button.tsx'
import { Avatar } from '../ui/identity.tsx'
import { Logo } from './Logo.tsx'
import { Sidebar } from './Sidebar.tsx'

const publicNav = [
  { label: 'Home', to: '/' },
  { label: 'Demo', hash: 'demo' },
  { label: 'How It Works', hash: 'how-it-works' },
  { label: 'Features', hash: 'features' },
  { label: 'Stories', hash: 'testimonials' },
  { label: 'Contact', to: '/contact' },
] as const

function PublicNavItem({
  label,
  to,
  hash,
  onNavigate,
}: {
  label: string
  to?: string
  hash?: string
  onNavigate?: () => void
}) {
  const { pathname } = useLocation()

  if (hash) {
    const href = pathname === '/' ? `#${hash}` : `/#${hash}`
    return (
      <a
        href={href}
        onClick={onNavigate}
        className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-black/[0.04] hover:text-navy-950"
      >
        {label}
      </a>
    )
  }

  return (
    <NavLink
      to={to!}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gradient-to-r from-coral-50 to-violet-50 text-violet-700'
                    : 'text-slate-600 hover:bg-violet-50/70 hover:text-navy-950',
        )
      }
    >
      {label}
    </NavLink>
  )
}

export function Navbar() {
  const { pathname } = useLocation()
  const { account, status, signOut } = useSession()
  const { unreadCount } = useNotifications()
  const { openAuth } = useAuthModal()
  const [open, setOpen] = useState(false)
  const signedIn = status === 'authenticated' && Boolean(account)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const unreadBadge = unreadCount != null && unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null

  if (signedIn) {
    return (
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Logo compact />
          <div className="flex items-center gap-1">
            <Link
              to="/candidate/notifications"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-navy-800 hover:bg-black/[0.04]"
              aria-label={unreadBadge ? `Notifications, ${unreadBadge} unread` : 'Notifications'}
            >
              <Bell className="h-5 w-5" />
              {unreadBadge ? (
                <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-coral-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                  {unreadBadge}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/[0.04]"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-navy-950/30"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[min(100%,18rem)] shadow-xl">
              <Sidebar unreadBadge={unreadBadge} onNavigate={() => setOpen(false)} onSignOut={() => void signOut()} />
            </div>
          </div>
        ) : null}
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/95 shadow-[0_1px_0_rgba(16,28,53,0.04)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {publicNav.map((link) => (
            <PublicNavItem key={link.label} label={link.label} to={'to' in link ? link.to : undefined} hash={'hash' in link ? link.hash : undefined} />
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <button type="button" className="text-sm font-medium text-navy-800 hover:text-coral-700" onClick={() => openAuth('login')}>
            Sign In
          </button>
          <Button size="sm" onClick={() => openAuth('register')}>
            Get started
          </Button>
        </div>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/[0.04] lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-black/[0.06] bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Primary mobile">
            {publicNav.map((link) => (
              <PublicNavItem
                key={link.label}
                label={link.label}
                to={'to' in link ? link.to : undefined}
                hash={'hash' in link ? link.hash : undefined}
                onNavigate={() => setOpen(false)}
              />
            ))}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" fullWidth onClick={() => openAuth('login')}>
                Sign In
              </Button>
              <Button fullWidth onClick={() => openAuth('register')}>
                Get started
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}

export function SignedInDesktopBar() {
  const { account } = useSession()
  return (
    <div className="hidden h-16 items-center justify-end gap-3 border-b border-black/[0.06] bg-white px-6 lg:flex">
      <Link to="/candidate/profile" className="inline-flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-black/[0.04]" aria-label="Profile">
        <Avatar src={account?.profile.avatar_url ?? ''} name={account?.profile.full_name || 'Profile'} size="sm" />
        <span className="max-w-[12rem] truncate text-sm font-medium text-navy-950">
          {account?.profile.full_name || 'Profile'}
        </span>
      </Link>
    </div>
  )
}

