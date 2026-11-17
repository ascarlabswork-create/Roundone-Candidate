import {
  ANSWER_HOLD_MS,
  NO_SPEECH_SKIP_MS,
  shouldCompleteSpokenAnswer,
  shouldSkipForNoSpeech,
} from './voiceTurn.ts'
import { classifyPracticeTurnIntent } from './turnIntent.ts'

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

expect(
  shouldSkipForNoSpeech({
    silenceMs: NO_SPEECH_SKIP_MS,
    answer: '',
    interviewerSpeaking: false,
    evaluating: false,
  }),
  'Long silence with no answer moves on',
)
expect(
  !shouldSkipForNoSpeech({
    silenceMs: NO_SPEECH_SKIP_MS,
    answer,
    interviewerSpeaking: false,
    evaluating: false,
  }),
  'An in-progress answer is not skipped for silence',
)

expect(classifyPracticeTurnIntent('can you repeat the question') === 'repeat', 'repeat intent')
expect(classifyPracticeTurnIntent("I don't know") === 'skip', 'dont know intent')
expect(classifyPracticeTurnIntent('skip this please') === 'skip', 'skip intent')
expect(
  classifyPracticeTurnIntent("I don't know the exact API but I would check the docs and retry with backoff") ===
    'answer',
  'long uncertain answer stays an answer',
)

console.log('voice turn checks passed')
