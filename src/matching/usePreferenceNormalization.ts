import { useCallback, useRef, useState } from 'react'
import { requestNormalizationAssist } from './normalizeAssist.ts'
import {
  hasNormalizableInput,
  type NormalizationInput,
  type UsableNormalization,
} from './normalizeModel.ts'

export type NormalizationStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable'

export function usePreferenceNormalization() {
  const [status, setStatus] = useState<NormalizationStatus>('idle')
  const [suggestions, setSuggestions] = useState<UsableNormalization | null>(null)
  const lastKey = useRef('')
  const inflight = useRef(0)

  const suggest = useCallback(async (input: NormalizationInput) => {
    if (!hasNormalizableInput(input)) {
      setSuggestions(null)
      setStatus('empty')
      return
    }
    const key = JSON.stringify(input)
    if (key === lastKey.current) return
    const token = ++inflight.current
    setStatus('loading')
    const result = await requestNormalizationAssist(input)
    if (token !== inflight.current) return
    if (!result.ok) {
      setSuggestions(null)
      setStatus('unavailable')
      return
    }
    lastKey.current = key
    if (result.suggestions) {
      setSuggestions(result.suggestions)
      setStatus('ready')
      return
    }
    setSuggestions(null)
    setStatus('empty')
  }, [])

  const clear = useCallback(() => {
    inflight.current += 1
    lastKey.current = ''
    setSuggestions(null)
    setStatus('idle')
  }, [])

  return { status, suggestions, suggest, clear }
}
