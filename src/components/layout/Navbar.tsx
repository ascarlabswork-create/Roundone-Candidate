import { Bell, CalendarCheck, Menu, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'
import { useSession } from '../../state/session.tsx'
import { Button } from '../ui/Button.tsx'
import { Logo } from './Logo.tsx'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/candidate/interviewers', label: 'Find Interviewer' },
  { to: '/candidate/practice', label: 'AI Practice' },
  { to: '/candidate/interview-types', label: 'Interview Types' },
  { to: '/candidate/resources', label: 'Resources' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const candidate = useSession()

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-slate-100 text-navy-950' : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/candidate/interviews"
            className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 md:inline-flex"
          >
            <CalendarCheck className="h-4 w-4" />
            My Interviews
          </Link>
          <Link
            to="/candidate/notifications"
            className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600" />
          </Link>
          <Link
            to="/candidate/profile"
            className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
            aria-label="Profile"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
              {candidate.name
                .split(' ')
                .map((part) => part[0])
                .join('')}
            </span>
            <UserRound className="hidden h-4 w-4 lg:block" />
          </Link>
          <Link to="/candidate/find" className="hidden sm:block">
            <Button size="sm">Find My Interviewer</Button>
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-navy-950 lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-slate-100 text-navy-950' : 'text-slate-700',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/candidate/interviews" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700">
              My Interviews
            </NavLink>
            <NavLink to="/candidate/profile" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700">
              Profile
            </NavLink>
            <Link to="/candidate/find" onClick={() => setOpen(false)} className="pt-2">
              <Button fullWidth>Find My Interviewer</Button>
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
