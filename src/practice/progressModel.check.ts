import {
  buildCompletedPracticePayload,
  formatPracticeScore,
  parsePracticeProgress,
  parsePracticeSessionSummary,
} from './progressModel.ts'
import { emptyPracticeSession } from './session.ts'
import { parsePracticeQuestions, type PracticeAiQuestion } from './aiModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runPracticeProgressChecks() {
  const summary = parsePracticeSessionSummary({
    id: '00000000-0000-4000-8000-000000000031',
    target_role: 'Backend Engineer',
    interview_type: 'Coding',
    difficulty: 'intermediate',
    topics: ['Python', 'REST APIs'],
    question_count: 5,
    questions_answered: 5,
    average_score: '8.2',
    status: 'completed',
    completed_at: '2026-09-18T12:00:00.000Z',
  })
  expect(summary?.averageScore === 8.2, 'Numeric score strings parse')
  expect(formatPracticeScore(summary?.averageScore ?? null) === '8.2 / 10', 'Score stays on the 1-10 practice scale')
  expect(
    parsePracticeSessionSummary({
      id: 'not-a-uuid',
      target_role: 'Backend Engineer',
      interview_type: 'Coding',
      difficulty: 'intermediate',
      question_count: 5,
      questions_answered: 5,
      average_score: 8.2,
      status: 'completed',
      completed_at: '2026-09-18T12:00:00.000Z',
    }) == null,
    'Non-uuid ids are rejected',
  )

  const progress = parsePracticeProgress({
    session_count: 2,
    questions_answered: 8,
    average_score: 7.5,
    highest_score: 8.2,
    latest: {
      id: '00000000-0000-4000-8000-000000000031',
      target_role: 'Backend Engineer',
      interview_type: 'Coding',
      difficulty: 'intermediate',
      question_count: 5,
      questions_answered: 5,
      average_score: 8.2,
      status: 'completed',
      completed_at: '2026-09-18T12:00:00.000Z',
    },
    trend: [
      {
        id: '00000000-0000-4000-8000-000000000030',
        completed_at: '2026-09-08T12:00:00.000Z',
        average_score: 7,
      },
      {
        id: '00000000-0000-4000-8000-000000000031',
        completed_at: '2026-09-18T12:00:00.000Z',
        average_score: 8.2,
      },
    ],
    strengths: ['Python fundamentals', 'API concepts'],
    topics_to_review: ['Error handling'],
  })
  expect(progress?.sessionCount === 2, 'Session counts stay numeric')
  expect(progress?.trend.length === 2, 'Trend uses stored points only')
  expect(progress?.strengths[0] === 'Python fundamentals', 'Recurring strengths come from stored themes')

  const questions: PracticeAiQuestion[] = parsePracticeQuestions(
    {
      questions: [
        {
          question: 'Explain how FastAPI validates request bodies and returns errors.',
          question_type: 'technical',
          topic: 'FastAPI',
          difficulty: 'intermediate',
          expected_focus: ['Request models', 'Validation errors', 'HTTP status codes'],
        },
      ],
    },
    {
      targetRole: 'Backend Engineer',
      interviewType: 'Coding',
      skills: ['Python', 'FastAPI'],
      difficulty: 'intermediate',
      questionCount: 3,
    },
  )!

  const payload = buildCompletedPracticePayload({
    ...emptyPracticeSession(),
    setup: {
      targetRole: 'Backend Engineer',
      interviewType: 'Coding',
      skills: ['Python', 'FastAPI'],
      difficulty: 'intermediate',
      questionCount: 3,
    },
    questions,
    turns: [
      {
        question: questions[0],
        answer: 'FastAPI uses Pydantic models and returns 422 for invalid bodies.',
        feedback: {
          score: 8,
          strengths: ['Named the validation library'],
          improvements: ['Mention status codes'],
          missingPoints: ['HTTP 422'],
          summary: 'Solid answer with a missing status-code detail.',
        },
      },
    ],
  })
  expect(!('candidate_profile_id' in payload), 'Save payload never includes candidate_profile_id')
  expect(payload.questions[0]?.answer?.score === 8, 'Stored answer keeps the practice score')
  expect(payload.question_count === 1, 'Question count matches generated questions')

  return true
}

runPracticeProgressChecks()
console.log('practice progress checks passed')
