import { ANSWER_HOLD_MS, shouldCompleteSpokenAnswer } from './voiceTurn.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const answer = 'I would validate input on the client and escape it before rendering.'

expect(
  !shouldCompleteSpokenAnswer({
    silenceMs: 4_000,
    answer,
    interviewerSpeaking: false,
    evaluating: false,
  }),
  'A few seconds of silence keeps the same answer',
)
expect(
  !shouldCompleteSpokenAnswer({
    silenceMs: ANSWER_HOLD_MS - 1,
    answer,
    interviewerSpeaking: false,
    evaluating: false,
  }),
  'The interviewer waits through the full thinking pause',
)
expect(
  shouldCompleteSpokenAnswer({
    silenceMs: ANSWER_HOLD_MS,
    answer,
    interviewerSpeaking: false,
    evaluating: false,
  }),
  'A long silence lets the interviewer continue',
)
expect(
  !shouldCompleteSpokenAnswer({
    silenceMs: ANSWER_HOLD_MS,
    answer: 'no',
    interviewerSpeaking: false,
    evaluating: false,
  }),
  'A short fragment is not treated as a finished answer',
)
expect(
  !shouldCompleteSpokenAnswer({
    silenceMs: ANSWER_HOLD_MS,
    answer,
    interviewerSpeaking: true,
    evaluating: false,
  }),
  'The interviewer does not cut in while asking the question',
)

console.log('voice turn checks passed')
