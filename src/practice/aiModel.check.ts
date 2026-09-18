import {
  averagePracticeScore,
  parsePracticeFeedback,
  parsePracticeQuestions,
  uniqueThemes,
  type PracticeSetup,
} from './aiModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const setup: PracticeSetup = {
  targetRole: 'Backend Engineer',
  interviewType: 'Coding',
  skills: ['Python', 'FastAPI'],
  difficulty: 'intermediate',
  questionCount: 5,
}

export function runPracticeAiChecks() {
  const parsed = parsePracticeQuestions(
    {
      questions: [
        {
          question_id: 'q1',
          question: 'Explain how FastAPI validates request bodies and returns errors.',
          question_type: 'technical',
          topic: 'FastAPI',
          difficulty: 'intermediate',
          expected_focus: ['Request models', 'Validation errors', 'HTTP status codes'],
        },
        {
          question: 'Too short',
          question_type: 'technical',
          topic: 'Python',
          difficulty: 'intermediate',
          expected_focus: ['Basics', 'Syntax'],
        },
        {
          question: 'This is a real Google interview question about Python internals.',
          question_type: 'technical',
          topic: 'Python',
          difficulty: 'intermediate',
          expected_focus: ['CPython', 'Memory', 'GIL'],
        },
        {
          question: 'Invented interviewer from Stripe asks you a confidential onsite prompt.',
          question_type: 'technical',
          topic: 'Invented Skill',
          difficulty: 'intermediate',
          expected_focus: ['API design', 'Error handling'],
        },
      ],
    },
    setup,
  )
  expect(parsed != null, 'Valid questions parse')
  expect(parsed!.length === 2, 'Short and banned questions are dropped')
  expect(parsed![0].topic === 'FastAPI', 'Known topic is kept')
  expect(parsed![1].topic === 'Python', 'Unknown topic falls back to a selected skill')

  const feedback = parsePracticeFeedback({
    score: 7,
    strengths: ['Correct explanation of REST principles'],
    improvements: ['Could explain error handling more clearly'],
    missing_points: ['HTTP status code discussion'],
    summary: 'Good foundation with some gaps in depth.',
  })
  expect(feedback?.score === 7, 'Practice score is kept')
  expect(feedback?.missingPoints.includes('HTTP status code discussion') === true, 'Missing points are kept')

  const hiring = parsePracticeFeedback({
    score: 9,
    strengths: ['Clear'],
    improvements: [],
    missing_points: [],
    summary: 'You are ready for the job and this is a hiring decision.',
  })
  expect(hiring == null, 'Hiring claims are rejected')

  const badScore = parsePracticeFeedback({
    score: 12,
    summary: 'Good foundation with some gaps in depth.',
    strengths: [],
    improvements: [],
    missing_points: [],
  })
  expect(badScore == null, 'Out-of-range scores are rejected')

  const avg = averagePracticeScore([
    { question: parsed![0], answer: 'REST uses resources.', feedback },
    { question: parsed![0], answer: 'skipped', feedback: null },
  ])
  expect(avg === 7, 'Average uses only scored answers')

  const themes = uniqueThemes(
    [
      { question: parsed![0], answer: 'a', feedback },
      { question: parsed![0], answer: 'b', feedback },
    ],
    'strengths',
  )
  expect(themes.length === 1, 'Duplicate strength themes are collapsed')

  return true
}

runPracticeAiChecks()
console.log('practice AI checks passed')
