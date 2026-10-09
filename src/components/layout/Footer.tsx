import { Link } from 'react-router-dom'
import { COPYRIGHT_NOTICE, LEGAL_LINKS } from '../../legal/legalCopy.ts'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        <nav aria-label="Legal" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
          {LEGAL_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm text-slate-500 underline-offset-2 hover:text-navy-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-slate-500">{COPYRIGHT_NOTICE}</p>
      </div>
    </footer>
  )
}
