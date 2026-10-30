import {
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  Home,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

export type AppNavLink = {
  to: string
  label: string
  end?: boolean
  icon: LucideIcon
}

export const guestLinks: AppNavLink[] = [
  { to: '/candidate/how-it-works', label: 'How it works', icon: BookOpen },
  { to: '/contact', label: 'Contact', icon: Briefcase },
]

export const signedInLinks: AppNavLink[] = [
  { to: '/', label: 'Home', end: true, icon: Home },
  { to: '/candidate/find', label: 'Find Interviewer', icon: Briefcase },
  { to: '/candidate/practice', label: 'AI Practice', icon: Sparkles },
  { to: '/candidate/preparation', label: 'AI Prep', icon: ClipboardCheck },
  { to: '/candidate/resources', label: 'Resources', icon: BookOpen },
  { to: '/candidate/interviews', label: 'My interviews', icon: CalendarDays },
  { to: '/candidate/notifications', label: 'Notifications', icon: Bell },
  { to: '/candidate/profile', label: 'Profile', icon: UserRound },
]
