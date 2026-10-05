/** How long the interviewer waits after the candidate stops talking before taking the next turn. */
export const ANSWER_HOLD_MS = 12_000

export const ANSWER_MIN_CHARS = 8

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
