import { Bell, CalendarDays, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'
import { useNotifications } from '../../state/notifications.tsx'
import { useSession } from '../../state/session.tsx'
import { Button } from '../ui/Button.tsx'
import { Avatar } from '../ui/identity.tsx'
import { Logo } from './Logo.tsx'

const guestLinks: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/candidate/how-it-works', label: 'How it works' },
  { to: '/contact', label: 'Contact' },
]

const signedInLinks: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Home', end: true },
  { to: '/candidate/find', label: 'Find Interviewer' },
  { to: '/candidate/practice', label: 'AI Practice' },
  { to: '/candidate/preparation', label: 'AI Prep' },
  { to: '/candidate/resources', label: 'Resources' },
]

export function Navbar() {
  const { pathname } = useLocation()
  const { account, status, signOut } = useSession()
  const { unreadCount } = useNotifications()
  const [open, setOpen] = useState(false)
  const signedIn = status === 'authenticated' && Boolean(account)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const links = signedIn ? signedInLinks : guestLinks
  const unreadBadge = unreadCount != null && unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null

  return (
    <header className="sticky top-0 z-40 border-b border-navy-950/8 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-navy-950 text-white' : 'text-slate-600 hover:bg-navy-950/5 hover:text-navy-950',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {signedIn ? (
            <>
              <Link
                to="/candidate/interviews"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-navy-800 hover:bg-navy-950/5"
                aria-label="My interviews"
              >
                <CalendarDays className="h-5 w-5" />
              </Link>
              <Link
                to="/candidate/notifications"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-navy-800 hover:bg-navy-950/5"
                aria-label={unreadBadge ? `Notifications, ${unreadBadge} unread` : 'Notifications'}
              >
                <Bell className="h-5 w-5" />
                {unreadBadge ? (
                  <span className="absolute right-1 top-1 min-w-4 rounded-full bg-coral-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                    {unreadBadge}
                  </span>
                ) : null}
              </Link>
              <Link to="/candidate/profile" aria-label="Profile" className="rounded-full">
                <Avatar src={account?.profile.avatar_url ?? ''} name={account?.profile.full_name || 'Profile'} size="sm" />
              </Link>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                Sign out
              </Button>
              <Link to="/candidate/find">
                <Button size="sm">Find My Interviewer</Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/candidate/login" className="text-sm font-semibold text-navy-800 hover:text-coral-700">
                Sign in
              </Link>
              <Link to="/candidate/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-navy-950/5 lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-navy-950/8 bg-paper px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-navy-950 text-white' : 'text-slate-700',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            {signedIn ? (
              <>
                <NavLink
                  to="/candidate/interviews"
                  className={({ isActive }) =>
                    cn('rounded-xl px-3 py-2.5 text-sm font-medium', isActive ? 'bg-navy-950 text-white' : 'text-slate-700')
                  }
                >
                  My interviews
                </NavLink>
                <NavLink
                  to="/candidate/notifications"
                  className={({ isActive }) =>
                    cn('rounded-xl px-3 py-2.5 text-sm font-medium', isActive ? 'bg-navy-950 text-white' : 'text-slate-700')
                  }
                >
                  Notifications{unreadBadge ? ` (${unreadBadge})` : ''}
                </NavLink>
                <NavLink
                  to="/candidate/profile"
                  className={({ isActive }) =>
                    cn('rounded-xl px-3 py-2.5 text-sm font-medium', isActive ? 'bg-navy-950 text-white' : 'text-slate-700')
                  }
                >
                  Profile
                </NavLink>
                <Button className="mt-2" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </>
            ) : (
              <div className="mt-3 flex gap-2">
                <Link to="/candidate/login" className="flex-1">
                  <Button variant="outline" fullWidth>
                    Sign in
                  </Button>
                </Link>
                <Link to="/candidate/register" className="flex-1">
                  <Button fullWidth>
                    Get started
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
