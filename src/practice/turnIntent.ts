/**
 * Detect when the candidate wants the current question repeated
 * instead of giving an interview answer.
 */
const REPEAT_PHRASES = [
  'repeat the question',
  'repeat question',
  'repeat that',
  'repeat it',
  'say that again',
  'say it again',
  'say again',
  'ask again',
  'ask the question again',
  'one more time',
  "didn't hear",
  'did not hear',
  "didn't understand",
  'did not understand',
  "didn't catch",
  'did not catch',
  "can't hear",
  'cannot hear',
  "couldn't hear",
  'could not hear',
  'come again',
  'pardon',
  'rephrase the question',
  'rephrase that',
  'what was the question',
  "what's the question",
  'what is the question',
  'can you repeat',
  'could you repeat',
  'please repeat',
  'would you repeat',
]

/**
 * Detect a polite pass / "I don't know" so the interviewer can move on
 * like a real conversation instead of scoring a non-answer.
 */
const SKIP_PHRASES = [
  "i don't know",
  'i do not know',
  'i dont know',
  "i'm not sure",
  'i am not sure',
  'im not sure',
  'not sure',
  'no idea',
  'no clue',
  'idk',
  "i've got nothing",
  'i got nothing',
  'drawing a blank',
  "i'm blank",
  'im blank',
  'skip this',
  'skip it',
  'skip the question',
  'can we skip',
  'could we skip',
  "let's skip",
  'lets skip',
  'pass on this',
  'pass on that',
  'next question',
  'move on',
  "let's move on",
  'lets move on',
  'whatever',
]

function normalizeUtterance(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isRepeatQuestionRequest(text: string): boolean {
  const normalized = normalizeUtterance(text)
  if (!normalized) return false
  if (normalized.length > 100) return false
  const words = normalized.split(' ')
  if (words.length > 16) return false
  if (REPEAT_PHRASES.some((phrase) => normalized.includes(phrase))) return true
  if (/^(can you |could you |please |would you )?(please )?repeat\b/.test(normalized) && words.length <= 12) {
    return true
  }
  return false
}

export function isSkipOrDontKnowRequest(text: string): boolean {
  const normalized = normalizeUtterance(text)
  if (!normalized) return false
  // Real answers that mention uncertainty should still be evaluated.
  if (normalized.length > 90) return false
  const words = normalized.split(' ')
  if (words.length > 14) return false

  if (SKIP_PHRASES.some((phrase) => normalized === phrase || normalized.includes(phrase))) {
    // "whatever" alone (or nearly alone) is a pass; longer "whatever you think…" is not.
    if (normalized.includes('whatever') && words.length > 4 && !normalized.includes('skip')) {
      return false
    }
    // "pass" alone / "I'll pass" — avoid matching "I would pass the data…"
    if (/\bpass\b/.test(normalized) && !/\b(pass on|i('| wi)?ll pass|just pass|can pass)\b/.test(normalized) && normalized !== 'pass') {
      if (words.length > 5) return false
    }
    return true
  }

  if (/^(i )?(really )?(just )?(don'?t|do not) know\b/.test(normalized)) return true
  if (/^(can|could) we (skip|move on|go (to )?(the )?next)\b/.test(normalized)) return true
  return false
}

export type PracticeTurnIntent = 'repeat' | 'skip' | 'answer'

export function classifyPracticeTurnIntent(text: string): PracticeTurnIntent {
  if (isRepeatQuestionRequest(text)) return 'repeat'
  if (isSkipOrDontKnowRequest(text)) return 'skip'
  return 'answer'
}
