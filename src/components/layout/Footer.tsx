import { Link } from 'react-router-dom'
import { Logo } from './Logo.tsx'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-md text-sm text-slate-600">
            RoundOne helps candidates find verified interviewers, book realistic mock interviews, and
            improve with structured feedback.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-navy-950">For candidates</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              <Link to="/candidate/find" className="hover:text-navy-900">
                Find My Interviewer
              </Link>
            </li>
            <li>
              <Link to="/candidate/interviewers" className="hover:text-navy-900">
                Browse interviewers
              </Link>
            </li>
            <li>
              <Link to="/candidate/progress" className="hover:text-navy-900">
                Track progress
              </Link>
            </li>
            <li>
              <Link to="/candidate/resources" className="hover:text-navy-900">
                Resources
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-navy-950">Prepare</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              <Link to="/candidate/interview-types" className="hover:text-navy-900">
                Interview types
              </Link>
            </li>
            <li>
              <Link to="/candidate/practice" className="hover:text-navy-900">
                AI Practice
              </Link>
            </li>
            <li>
              <Link to="/candidate/preparation" className="hover:text-navy-900">
                AI Preparation
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} RoundOne. Candidate prototype.
      </div>
    </footer>
  )
}
