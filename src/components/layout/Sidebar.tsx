import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'
import { Button } from '../ui/Button.tsx'
import { Logo } from './Logo.tsx'
import { signedInLinks } from './nav.ts'

export function Sidebar({
  unreadBadge,
  onNavigate,
  onSignOut,
}: {
  unreadBadge: string | null
  onNavigate?: () => void
  onSignOut: () => void
}) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-black/[0.06] bg-white">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2" aria-label="Main">
        {signedInLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                isActive ? 'bg-coral-50 text-coral-700' : 'text-slate-600 hover:bg-black/[0.04] hover:text-navy-950',
              )
            }
          >
            <link.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate">{link.label}</span>
            {link.to === '/candidate/notifications' && unreadBadge ? (
              <span className="rounded-full bg-coral-600 px-1.5 text-[10px] font-semibold leading-4 text-white">
                {unreadBadge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-black/[0.06] p-3">
        <NavLink to="/candidate/find" onClick={onNavigate}>
          <Button size="sm" fullWidth>
            Find My Interviewer
          </Button>
        </NavLink>
        <Button variant="ghost" size="sm" fullWidth onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </aside>
  )
}
