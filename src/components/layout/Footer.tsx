import { Link } from 'react-router-dom'
import { COPYRIGHT_NOTICE } from '../../legal/legalCopy.ts'
import { Logo } from './Logo.tsx'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-navy-950/8 bg-navy-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo inverted />
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            Mock interviews with people who have sat on the other side of the table. Practice, get scored, then walk into
            the real round ready.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">Product</p>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Link className="hover:text-white" to="/candidate/how-it-works">
              How it works
            </Link>
            <Link className="hover:text-white" to="/candidate/find">
              Find interviewers
            </Link>
            <Link className="hover:text-white" to="/candidate/practice">
              AI practice
            </Link>
            <Link className="hover:text-white" to="/candidate/resources">
              Resources
            </Link>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">Company</p>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Link className="hover:text-white" to="/contact">
              Contact
            </Link>
            <Link className="hover:text-white" to="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-white" to="/terms">
              Terms
            </Link>
            <Link className="hover:text-white" to="/cookies">
              Cookies
            </Link>
            <Link className="hover:text-white" to="/refund-policy">
              Refunds
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500 sm:px-6">{COPYRIGHT_NOTICE}</p>
      </div>
    </footer>
  )
}
