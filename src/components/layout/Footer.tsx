import { Link } from 'react-router-dom'
import { COPYRIGHT_NOTICE } from '../../legal/legalCopy.ts'
import { useAuthModal } from '../../state/authModal.tsx'
import { Logo } from './Logo.tsx'

export function Footer() {
  const { openAuth } = useAuthModal()

  return (
    <footer className="mt-auto border-t border-black/[0.06] bg-white text-slate-500">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm leading-6">
            AI-powered mock interviews and live practice with experienced professionals — built for candidates preparing
            for their next opportunity.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Explore</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link className="hover:text-navy-950" to="/candidate/how-it-works">
              How It Works
            </Link>
            <a className="hover:text-navy-950" href="/#features">
              Features
            </a>
            <Link className="hover:text-navy-950" to="/contact">
              Contact
            </Link>
            <button type="button" className="text-left hover:text-navy-950" onClick={() => openAuth('login')}>
              Sign In
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Legal</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link className="hover:text-navy-950" to="/privacy">
              Privacy Policy
            </Link>
            <Link className="hover:text-navy-950" to="/terms">
              Terms and Conditions
            </Link>
            <Link className="hover:text-navy-950" to="/cookies">
              Cookie Preferences
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
