/** How long the interviewer waits after the candidate stops talking before taking the next turn. */
export const ANSWER_HOLD_MS = 12_000

export const ANSWER_MIN_CHARS = 8

/**
 * After the question is asked, how long to wait with no real answer before
 * moving on — like a live interviewer who won't leave you hanging forever.
 */
export const NO_SPEECH_SKIP_MS = 25_000

/** If the candidate only mumbled, wait a bit longer then move on. */
export const NO_SPEECH_AFTER_MUMBLE_MS = 15_000

/**
 * A thinking pause keeps the same answer. The interviewer continues only after
 * a long silence, and only when the candidate is not already being evaluated.
 */
export function shouldCompleteSpokenAnswer(input: {
  silenceMs: number
  answer: string
  interviewerSpeaking: boolean
  evaluating: boolean
}) {
  if (input.interviewerSpeaking || input.evaluating) return false
  if (input.answer.trim().length < ANSWER_MIN_CHARS) return false
  return input.silenceMs >= ANSWER_HOLD_MS
}

/** True when silence with no answer should advance the interview. */
export function shouldSkipForNoSpeech(input: {
  silenceMs: number
  answer: string
  interviewerSpeaking: boolean
  evaluating: boolean
  thresholdMs?: number
}) {
  if (input.interviewerSpeaking || input.evaluating) return false
  if (input.answer.trim().length >= ANSWER_MIN_CHARS) return false
  return input.silenceMs >= (input.thresholdMs ?? NO_SPEECH_SKIP_MS)
}
