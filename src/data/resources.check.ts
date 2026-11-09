import { rankResourcesForCandidate, scoreResource, CANDIDATE_RESOURCES } from './resources.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

expect(CANDIDATE_RESOURCES.length >= 8, 'Catalog has enough resources')
expect(
  CANDIDATE_RESOURCES.every((item) => item.steps.length >= 3 && item.summary.trim().length > 20),
  'Every resource has actionable steps',
)

const ml = rankResourcesForCandidate({
  role: 'ML Engineer',
  skills: ['PyTorch', 'NLP'],
  interviewType: 'Machine Learning',
})
expect(ml[0]?.resource.id === 'ml-interview-loop', 'ML candidates get the ML guide first')

const devops = rankResourcesForCandidate({
  role: 'DevOps Engineer',
  skills: ['Kubernetes', 'Docker', 'AWS'],
})
expect(devops[0]?.resource.id === 'devops-incident', 'DevOps candidates get the DevOps checklist first')

const universal = scoreResource(
  CANDIDATE_RESOURCES.find((item) => item.id === 'mock-scorecard')!,
  { role: 'Designer', skills: [] },
)
expect(universal >= 1, 'Universal templates still score for any candidate')

console.log('candidate resources checks passed')
