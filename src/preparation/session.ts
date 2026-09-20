import { readSessionJson, removeSession, writeSessionJson } from '../lib/storage.ts'
import type { PreparationInput, PreparationResult } from './aiModel.ts'

const STORAGE_KEY = 'roundone.preparation.ai'

export type SavedPreparation = {
  version: 1
  inputHash: string
  input: PreparationInput
  result: PreparationResult
  generatedAt: string
}

export function readSavedPreparation(): SavedPreparation | null {
  const saved = readSessionJson<SavedPreparation | null>(STORAGE_KEY, null)
  if (saved?.version !== 1 || !saved.result || !saved.inputHash) return null
  return saved
}

export function writeSavedPreparation(value: SavedPreparation) {
  writeSessionJson(STORAGE_KEY, value)
}

export function clearSavedPreparation() {
  removeSession(STORAGE_KEY)
}
