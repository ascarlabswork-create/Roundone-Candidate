import { Link } from 'react-router-dom'
import { COPYRIGHT_NOTICE } from '../../legal/legalCopy.ts'
import { useAuthModal } from '../../state/authModal.tsx'
import { useSession } from '../../state/session.tsx'
import { Logo } from './Logo.tsx'

const signedInFeatureLinks = [
  { to: '/candidate/find', label: 'Find interviewers' },
  { to: '/candidate/job-match', label: 'Match to a job' },
  { to: '/candidate/practice', label: 'AI practice' },
  { to: '/candidate/preparation', label: 'AI prep' },
  { to: '/candidate/ats-check', label: 'ATS check' },
  { to: '/candidate/resources', label: 'Resources' },
  { to: '/candidate/how-it-works', label: 'How it works' },
] as const

const signedInAccountLinks = [
  { to: '/', label: 'Home' },
  { to: '/candidate/interviews', label: 'My interviews' },
  { to: '/candidate/progress', label: 'Progress' },
  { to: '/candidate/notifications', label: 'Notifications' },
  { to: '/candidate/profile', label: 'Profile' },
] as const

export function Footer() {
  const { openAuth } = useAuthModal()
  const { status, account } = useSession()
  const signedIn = status === 'authenticated' && Boolean(account)

  if (signedIn) {
    return (
      <footer className="mt-auto border-t border-black/[0.06] bg-white text-slate-500">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-6">
              Mock interviews with people who have sat on the other side of the table.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Features</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {signedInFeatureLinks.map((link) => (
                <Link key={link.to} className="hover:text-navy-950" to={link.to}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Account</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {signedInAccountLinks.map((link) => (
                <Link key={link.to} className="hover:text-navy-950" to={link.to}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Legal</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link className="hover:text-navy-950" to="/contact">
                Contact
              </Link>
              <Link className="hover:text-navy-950" to="/privacy">
                Privacy
              </Link>
              <Link className="hover:text-navy-950" to="/terms">
                Terms
              </Link>
              <Link className="hover:text-navy-950" to="/cookies">
                Cookies
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-black/[0.06]">
          <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-400 sm:px-6">{COPYRIGHT_NOTICE}</p>
        </div>
      </footer>
    )
  }

  return (
    <footer className="mt-auto border-t border-white/10 bg-gradient-to-br from-[#101c35] via-[#1e3a8a] to-[#4c1d95] text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo inverted />
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            AI-powered mock interviews and live practice with experienced professionals — built for your next hiring
            round.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Explore</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm">
            <a className="hover:text-white" href="/#home">
              Home
            </a>
            <Link className="hover:text-white" to="/candidate/how-it-works">
              How It Works
            </Link>
            <a className="hover:text-white" href="/#features">
              Features
            </a>
            <Link className="hover:text-white" to="/contact">
              Contact
            </Link>
            <button type="button" className="text-left hover:text-white" onClick={() => openAuth('login')}>
              Sign In
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Legal</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm">
            <Link className="hover:text-white" to="/privacy">
              Privacy Policy
            </Link>
            <Link className="hover:text-white" to="/terms">
              Terms and Conditions
            </Link>
            <Link className="hover:text-white" to="/cookies">
              Cookie Preferences
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-500 sm:px-6">{COPYRIGHT_NOTICE}</p>
      </div>
    </footer>
  )
}
