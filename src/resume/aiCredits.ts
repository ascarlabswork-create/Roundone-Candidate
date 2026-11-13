/** Client-side AI credit wallet for resume/ATS features (per browser until server metering ships). */

export const ATS_AI_IMPROVE_COST = 2
export const RESUME_SKILL_PLAN_COST = 1
export const STARTING_AI_CREDITS = 10

const STORAGE_KEY = 'jobround.ai_credits.v1'

function readBalance(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) {
      localStorage.setItem(STORAGE_KEY, String(STARTING_AI_CREDITS))
      return STARTING_AI_CREDITS
    }
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : STARTING_AI_CREDITS
  } catch {
    return STARTING_AI_CREDITS
  }
}

function writeBalance(next: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.floor(next))))
  } catch {
    /* private mode */
  }
}

export function getAiCredits() {
  return readBalance()
}

export function canSpendAiCredits(cost: number) {
  return readBalance() >= Math.max(0, Math.floor(cost))
}

/** Returns false when the balance is too low. */
export function spendAiCredits(cost: number) {
  const amount = Math.max(0, Math.floor(cost))
  const current = readBalance()
  if (current < amount) return false
  writeBalance(current - amount)
  return true
}

export function refundAiCredits(cost: number) {
  writeBalance(readBalance() + Math.max(0, Math.floor(cost)))
}
