import {
  canGeneratePreparation,
  parsePreparationResult,
  preparationInputHash,
  practiceHrefFromPreparation,
  type PreparationInput,
} from './aiModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runPreparationChecks() {
  const input: PreparationInput = {
    targetRole: 'Backend Engineer',
    experienceLevel: 'SDE 2',
    skills: ['Python', 'FastAPI', 'PostgreSQL'],
    interviewType: 'Coding',
    resumeText: '',
  }
  expect(canGeneratePreparation(input) === true, 'Profile-only context can generate')
  expect(canGeneratePreparation({ ...input, targetRole: '', skills: [], resumeText: 'short' }) === false, 'Thin input blocked')

  const parsed = parsePreparationResult({
    profile_summary: 'Based on your Backend Engineer profile and Python/FastAPI skills, focus on API and data fundamentals.',
    priority_topics: [
      { topic: 'Python', reason: 'Listed in your skills and useful for Coding interviews.', priority: 'high' },
      { topic: 'Invented Magic', reason: 'You will get hired for sure.', priority: 'high' },
    ],
    interview_focus_areas: ['API design', 'Database fundamentals'],
    practice_recommendations: [{ topic: 'FastAPI', question_count: 3, difficulty: 'intermediate' }],
  })
  expect(parsed != null, 'Valid preparation parses')
  expect(parsed!.priorityTopics.length === 1, 'Banned hiring claim topics are dropped')
  expect(parsed!.practiceRecommendations[0]?.questionCount === 3, 'Practice recommendation kept')

  const banned = parsePreparationResult({
    profile_summary: 'Your resume is job-ready and this guarantees hiring probability.',
    priority_topics: [],
    interview_focus_areas: [],
    practice_recommendations: [],
  })
  expect(banned == null, 'Banned summary is rejected')

  const hashA = preparationInputHash(input)
  const hashB = preparationInputHash({ ...input, resumeText: '  ' })
  expect(hashA === hashB, 'Whitespace-only resume does not change hash')
  expect(practiceHrefFromPreparation(input, parsed!).includes('again=1') === true, 'Practice link prefills setup')
  expect(practiceHrefFromPreparation(input, parsed!).includes('Python') || practiceHrefFromPreparation(input, parsed!).includes('FastAPI'), 'Practice link includes topics')

  return true
}

runPreparationChecks()
console.log('preparation checks passed')
