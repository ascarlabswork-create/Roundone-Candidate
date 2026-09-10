import { addDays, startOfDay } from '../lib/dates.ts'
import type { AvailabilitySlot, Interviewer, Service } from '../types.ts'

let slotSeq = 0

function slot(date: Date, durationMin: number): AvailabilitySlot {
  slotSeq += 1
  return {
    id: `slot-${slotSeq}`,
    start: date.toISOString(),
    durationMin,
  }
}

function upcomingSlots(
  weekdayHours: Array<{ weekday: number; hour: number; minute?: number }>,
  durationMin = 60,
  count = 8,
) {
  const slots: AvailabilitySlot[] = []
  const start = startOfDay(new Date())
  const now = new Date()

  for (let d = 0; d < 28 && slots.length < count; d += 1) {
    const day = addDays(start, d)
    for (const rule of weekdayHours) {
      if (day.getDay() !== rule.weekday) continue
      const date = new Date(day)
      date.setHours(rule.hour, rule.minute ?? 0, 0, 0)
      if (date <= now) continue
      slots.push(slot(date, durationMin))
    }
  }

  return slots
}

function service(
  id: string,
  name: string,
  interviewType: Service['interviewType'],
  durationMin: number,
  price: number,
  description: string,
): Service {
  return { id, name, interviewType, durationMin, price, description }
}

export const interviewers: Interviewer[] = [
  {
    id: 'rahul-sharma',
    name: 'Rahul Sharma',
    photo: '/avatars/rahul.svg',
    currentRole: 'Staff Software Engineer',
    company: 'Google',
    experienceYears: 8,
    skills: ['System Design', 'Backend', 'Distributed Systems', 'Microservices'],
    technologies: ['Java', 'AWS', 'Kubernetes', 'Go'],
    interviewTypes: ['System Design', 'Coding', 'Behavioral'],
    candidateLevels: ['SDE 2', 'Senior', 'Staff'],
    targetRoles: ['Software Engineer', 'Backend Engineer', 'Full Stack Engineer'],
    rating: 4.9,
    reviewCount: 234,
    completedInterviews: 428,
    price: 1500,
    currency: 'INR',
    services: [
      service('rahul-coding', 'Coding Mock', 'Coding', 60, 1000, 'DSA round with follow-ups on complexity and trade-offs.'),
      service('rahul-sysdesign', 'System Design Mock', 'System Design', 60, 1500, 'End-to-end design of a large-scale product, with diagrams and deep dives.'),
      service('rahul-behavioral', 'Behavioral Mock', 'Behavioral', 45, 800, 'Leadership, conflict, and Google-style behavioral stories.'),
      service('rahul-full', 'Full Interview', 'System Design', 90, 2000, 'Coding plus system design with a written scorecard.'),
    ],
    availability: upcomingSlots([
      { weekday: 3, hour: 20 },
      { weekday: 6, hour: 19 },
      { weekday: 0, hour: 10 },
    ]),
    isOnline: true,
    verification: { identity: true, employment: true, linkedin: true },
    bio: 'Staff engineer on Google Cloud storage. Rahul has run 400+ mock interviews for SDE 2 through Staff candidates, with a focus on realistic system design loops used at Google, Amazon, and Uber. Sessions end with a written scorecard and a recommended practice plan.',
    previousCompanies: ['Amazon', 'Microsoft'],
    languages: ['English', 'Hindi'],
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'marcus-chen',
    name: 'Marcus Chen',
    photo: '/avatars/marcus.svg',
    currentRole: 'Principal Engineer',
    company: 'Amazon',
    experienceYears: 12,
    skills: ['System Design', 'Distributed Systems', 'Backend', 'DSA'],
    technologies: ['Java', 'AWS', 'DynamoDB', 'Kotlin'],
    interviewTypes: ['Coding', 'System Design'],
    candidateLevels: ['SDE 1', 'SDE 2', 'Senior', 'Staff'],
    targetRoles: ['Software Engineer', 'Backend Engineer'],
    rating: 4.8,
    reviewCount: 191,
    completedInterviews: 512,
    price: 1800,
    currency: 'INR',
    services: [
      service('marcus-coding', 'Coding Mock', 'Coding', 60, 1400, 'Amazon-style coding with leadership principles woven in.'),
      service('marcus-sysdesign', 'System Design Mock', 'System Design', 60, 1800, 'High-scale retail and streaming system design.'),
      service('marcus-full', 'Full Interview', 'System Design', 90, 2400, 'Bar-raiser style loop with written feedback.'),
    ],
    availability: upcomingSlots([
      { weekday: 2, hour: 18, minute: 30 },
      { weekday: 4, hour: 19 },
      { weekday: 6, hour: 11 },
    ]),
    isOnline: true,
    verification: { identity: true, employment: true, linkedin: true },
    bio: 'Principal engineer on Amazon retail platform. Marcus previously bar-raised for SDE and Senior loops. He is direct, structured, and known for turning vague design answers into clear architecture decisions.',
    previousCompanies: ['Microsoft', 'Oracle'],
    languages: ['English'],
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'ananya-rao',
    name: 'Ananya Rao',
    photo: '/avatars/ananya.svg',
    currentRole: 'Engineering Manager',
    company: 'Microsoft',
    experienceYears: 11,
    skills: ['System Design', 'Behavioral', 'Communication', 'Leadership'],
    technologies: ['C#', 'Azure', 'TypeScript', 'SQL'],
    interviewTypes: ['Behavioral', 'System Design', 'Coding'],
    candidateLevels: ['SDE 2', 'Senior', 'Staff'],
    targetRoles: ['Software Engineer', 'Engineering Manager', 'Backend Engineer'],
    rating: 4.9,
    reviewCount: 156,
    completedInterviews: 287,
    price: 1600,
    currency: 'INR',
    services: [
      service('ananya-behavioral', 'Behavioral Mock', 'Behavioral', 45, 1200, 'As-a-manager and as-a-tech-lead behavioral loops.'),
      service('ananya-sysdesign', 'System Design Mock', 'System Design', 60, 1600, 'Design interviews with a hiring-manager lens.'),
      service('ananya-full', 'Full Interview', 'Behavioral', 90, 2200, 'Mixed loop covering design, coding, and leadership.'),
    ],
    availability: upcomingSlots([
      { weekday: 1, hour: 20 },
      { weekday: 5, hour: 18 },
      { weekday: 6, hour: 16 },
    ]),
    isOnline: false,
    verification: { identity: true, employment: true, linkedin: true },
    bio: 'EM on Microsoft Teams. Ananya coaches candidates who are strong technically but lose points on communication, scope, and leadership signals. Expect precise notes on what a hiring committee actually debates.',
    previousCompanies: ['Google', 'Flipkart'],
    languages: ['English', 'Hindi'],
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'priya-nair',
    name: 'Priya Nair',
    photo: '/avatars/priya.svg',
    currentRole: 'Senior Product Manager',
    company: 'Meta',
    experienceYears: 9,
    skills: ['Product Sense', 'Communication', 'Analytics', 'Prioritization'],
    technologies: ['SQL', 'Figma', 'Experimentation'],
    interviewTypes: ['Product', 'Behavioral'],
    candidateLevels: ['SDE 2', 'Senior', 'Staff'],
    targetRoles: ['Product Manager'],
    rating: 4.8,
    reviewCount: 142,
    completedInterviews: 210,
    price: 1700,
    currency: 'INR',
    services: [
      service('priya-product', 'Product Sense Mock', 'Product', 45, 1700, 'Product sense, execution, and metric design.'),
      service('priya-behavioral', 'Leadership Mock', 'Behavioral', 45, 1400, 'PM behavioral stories with Meta-style follow-ups.'),
    ],
    availability: upcomingSlots([
      { weekday: 2, hour: 19 },
      { weekday: 4, hour: 8 },
      { weekday: 0, hour: 17 },
    ]),
    isOnline: true,
    verification: { identity: true, employment: true, linkedin: true },
    bio: 'PM on Instagram growth. Priya ran product loops at Meta and previously at Stripe. She trains candidates to structure product sense answers, pick the right metric, and defend trade-offs without rambling.',
    previousCompanies: ['Stripe', 'Google'],
    languages: ['English', 'Hindi'],
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'arjun-patel',
    name: 'Arjun Patel',
    photo: '/avatars/arjun.svg',
    currentRole: 'Staff ML Engineer',
    company: 'OpenAI',
    experienceYears: 10,
    skills: ['Machine Learning', 'System Design', 'Python', 'ML System Design'],
    technologies: ['Python', 'PyTorch', 'GCP', 'SQL'],
    interviewTypes: ['Machine Learning', 'Coding', 'System Design'],
    candidateLevels: ['SDE 2', 'Senior', 'Staff'],
    targetRoles: ['ML Engineer', 'Software Engineer'],
    rating: 4.7,
    reviewCount: 98,
    completedInterviews: 164,
    price: 2200,
    currency: 'INR',
    services: [
      service('arjun-ml', 'ML Interview Mock', 'Machine Learning', 60, 2200, 'ML fundamentals, applied modeling, and ML system design.'),
      service('arjun-coding', 'Coding Mock', 'Coding', 60, 1600, 'Python coding with ML-flavored follow-ups.'),
    ],
    availability: upcomingSlots([
      { weekday: 3, hour: 21 },
      { weekday: 6, hour: 9 },
      { weekday: 0, hour: 18 },
    ]),
    isOnline: true,
    verification: { identity: true, employment: true, linkedin: false },
    bio: 'Staff ML engineer working on evaluation and ranking. Arjun covers classical ML, deep learning, and production ML systems. Best for candidates targeting applied scientist or ML engineer loops.',
    previousCompanies: ['Google', 'Meta'],
    languages: ['English', 'Hindi'],
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'sneha-iyer',
    name: 'Sneha Iyer',
    photo: '/avatars/sneha.svg',
    currentRole: 'Senior Data Scientist',
    company: 'Stripe',
    experienceYears: 7,
    skills: ['SQL', 'Experimentation', 'Machine Learning', 'Communication'],
    technologies: ['Python', 'SQL', 'dbt', 'Looker'],
    interviewTypes: ['Data Science', 'Behavioral'],
    candidateLevels: ['New Grad', 'SDE 1', 'SDE 2', 'Senior'],
    targetRoles: ['Data Scientist'],
    rating: 4.8,
    reviewCount: 121,
    completedInterviews: 188,
    price: 1400,
    currency: 'INR',
    services: [
      service('sneha-ds', 'Data Science Mock', 'Data Science', 60, 1400, 'Case, metrics, SQL, and take-home style walkthroughs.'),
      service('sneha-behavioral', 'Behavioral Mock', 'Behavioral', 45, 900, 'Cross-functional storytelling for DS loops.'),
    ],
    availability: upcomingSlots([
      { weekday: 1, hour: 19 },
      { weekday: 5, hour: 12 },
      { weekday: 6, hour: 15 },
    ]),
    isOnline: false,
    verification: { identity: true, employment: true, linkedin: true },
    bio: 'Data scientist on Stripe risk. Sneha helps candidates turn messy product questions into a metric tree, a sound experiment, and a decision. SQL rounds include live debugging, not just perfect queries.',
    previousCompanies: ['Amazon', 'Swiggy'],
    languages: ['English', 'Hindi'],
    timezone: 'Asia/Kolkata',
  },
  {
    id: 'fatima-khan',
    name: 'Fatima Khan',
    photo: '/avatars/fatima.svg',
    currentRole: 'Staff Frontend Engineer',
    company: 'Netflix',
    experienceYears: 9,
    skills: ['React', 'TypeScript', 'System Design', 'DSA'],
    technologies: ['TypeScript', 'React', 'Node.js', 'GraphQL'],
    interviewTypes: ['Coding', 'System Design'],
    candidateLevels: ['SDE 1', 'SDE 2', 'Senior', 'Staff'],
    targetRoles: ['Frontend Engineer', 'Full Stack Engineer', 'Software Engineer'],
    rating: 4.9,
    reviewCount: 167,
    completedInterviews: 246,
    price: 1500,
    currency: 'INR',
    services: [
      service('fatima-coding', 'Frontend Coding Mock', 'Coding', 60, 1300, 'UI coding, JavaScript internals, and accessibility.'),
      service('fatima-sysdesign', 'Frontend System Design', 'System Design', 60, 1500, 'Design a web app: performance, state, and rendering.'),
    ],
    availability: upcomingSlots([
      { weekday: 2, hour: 20 },
      { weekday: 4, hour: 20 },
      { weekday: 0, hour: 11 },
    ]),
    isOnline: true,
    verification: { identity: true, employment: true, linkedin: true },
    bio: 'Staff frontend engineer on Netflix web playback. Fatima runs realistic UI and frontend architecture interviews, including performance budgets, design systems, and component API decisions.',
    previousCompanies: ['Microsoft', 'Atlassian'],
    languages: ['English', 'Hindi'],
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'david-kim',
    name: 'David Kim',
    photo: '/avatars/david.svg',
    currentRole: 'Senior Backend Engineer',
    company: 'Uber',
    experienceYears: 6,
    skills: ['Backend', 'Java', 'Microservices', 'DSA'],
    technologies: ['Java', 'Go', 'AWS', 'Kafka'],
    interviewTypes: ['Coding', 'System Design'],
    candidateLevels: ['New Grad', 'SDE 1', 'SDE 2', 'Senior'],
    targetRoles: ['Software Engineer', 'Backend Engineer'],
    rating: 4.6,
    reviewCount: 88,
    completedInterviews: 132,
    price: 1100,
    currency: 'INR',
    services: [
      service('david-coding', 'Coding Mock', 'Coding', 60, 1100, 'Medium-hard DSA with production follow-ups.'),
      service('david-sysdesign', 'System Design Mock', 'System Design', 60, 1300, 'Marketplace and geo-system design at SDE 2 depth.'),
    ],
    availability: upcomingSlots([
      { weekday: 3, hour: 21 },
      { weekday: 5, hour: 19 },
      { weekday: 6, hour: 13 },
    ]),
    isOnline: true,
    verification: { identity: true, employment: false, linkedin: true },
    bio: 'Senior backend engineer on Uber Dispatch. David is a strong fit for SDE 1–2 candidates who want honest coding feedback and a first system design interview that is challenging without being Staff-level.',
    previousCompanies: ['Amazon'],
    languages: ['English', 'Spanish'],
    timezone: 'America/New_York',
  },
]

export function getInterviewerById(id: string) {
  return interviewers.find((person) => person.id === id)
}

export function getNextSlot(interviewer: Interviewer, from = new Date()) {
  return [...interviewer.availability]
    .filter((item) => new Date(item.start) >= from)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0]
}

export function isVerified(interviewer: Interviewer) {
  return interviewer.verification.identity && interviewer.verification.employment
}

export function lowestServicePrice(interviewer: Interviewer) {
  return Math.min(...interviewer.services.map((item) => item.price), interviewer.price)
}
