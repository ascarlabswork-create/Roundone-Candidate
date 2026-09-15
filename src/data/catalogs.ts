export const INTERVIEW_TYPES = [
  'Coding',
  'System Design',
  'Behavioral',
  'Machine Learning',
  'Product',
  'Data Science',
] as const

export type InterviewType = (typeof INTERVIEW_TYPES)[number]

export const CANDIDATE_LEVELS = [
  'Intern',
  'New Grad',
  'Junior',
  'SDE 1',
  'SDE 2',
  'SDE 3',
  'Senior',
  'Staff',
  'Senior Staff',
  'Principal',
  'Distinguished',
  'Lead',
  'Engineering Manager',
  'Director',
] as const

export type CandidateLevel = (typeof CANDIDATE_LEVELS)[number]

export const TARGET_ROLES = [
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'Mobile Engineer',
  'iOS Engineer',
  'Android Engineer',
  'DevOps Engineer',
  'Site Reliability Engineer',
  'Data Engineer',
  'ML Engineer',
  'AI Engineer',
  'Data Scientist',
  'Data Analyst',
  'Security Engineer',
  'QA Engineer',
  'Cloud Engineer',
  'Solutions Architect',
  'Product Manager',
  'Engineering Manager',
  'Technical Program Manager',
  'UX Designer',
] as const

export const COMPANIES = [
  'Google',
  'Amazon',
  'Microsoft',
  'Meta',
  'Apple',
  'Netflix',
  'Stripe',
  'Uber',
  'OpenAI',
  'Atlassian',
  'Adobe',
  'Salesforce',
  'Oracle',
  'IBM',
  'LinkedIn',
  'Airbnb',
  'Nvidia',
  'Intel',
  'Cisco',
  'PayPal',
  'Goldman Sachs',
  'JPMorgan',
  'Walmart',
  'Tesla',
  'Snowflake',
  'Databricks',
  'Flipkart',
  'Swiggy',
  'Zomato',
  'Razorpay',
  'Paytm',
  'PhonePe',
  'Zoho',
  'Freshworks',
  'TCS',
  'Infosys',
  'Wipro',
  'Accenture',
] as const

export const SKILLS = [
  'Java',
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Go',
  'AWS',
  'GCP',
  'Kubernetes',
  'Microservices',
  'Distributed Systems',
  'System Design',
  'DSA',
  'SQL',
  'Machine Learning',
  'PyTorch',
  'Product Sense',
  'Communication',
] as const

export const LANGUAGES = ['English', 'Hindi', 'Spanish'] as const

export const TIME_WINDOWS = [
  { id: 'morning', label: 'Morning (8:00 AM – 12:00 PM)' },
  { id: 'afternoon', label: 'Afternoon (12:00 PM – 5:00 PM)' },
  { id: 'evening', label: 'Evening (5:00 PM – 9:00 PM)' },
] as const

export type TimeWindow = (typeof TIME_WINDOWS)[number]['id']

export const SORT_OPTIONS = [
  { id: 'best-match', label: 'Best Match' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'highest-rated', label: 'Highest Rated' },
  { id: 'most-experienced', label: 'Most Experienced' },
  { id: 'lowest-price', label: 'Lowest Price' },
  { id: 'earliest', label: 'Earliest Availability' },
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]['id']

export const TIMEZONES = [
  'Asia/Kolkata',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Asia/Singapore',
] as const

export const POPULAR_COMPANIES = [
  'Google',
  'Amazon',
  'Microsoft',
  'Meta',
  'Apple',
  'Netflix',
  'Stripe',
  'Uber',
] as const
