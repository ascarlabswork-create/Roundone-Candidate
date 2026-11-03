import { useCallback, useEffect, useRef, useState } from 'react'

export function useDemoNarration() {
  const [voicesReady, setVoicesReady] = useState(false)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      voiceRef.current =
        voices.find((v) => v.lang.startsWith('en') && /google|natural|samantha|aria/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith('en-US')) ??
        voices.find((v) => v.lang.startsWith('en')) ??
        null
      setVoicesReady(true)
    }

    pickVoice()
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice)
  }, [])

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onEnd?.()
        return
      }
      cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.02
      utterance.pitch = 1
      if (voiceRef.current) utterance.voice = voiceRef.current
      utterance.onend = () => onEnd?.()
      utterance.onerror = () => onEnd?.()
      window.speechSynthesis.speak(utterance)
    },
    [cancel],
  )

  return { speak, cancel, voicesReady, supported: typeof window !== 'undefined' && 'speechSynthesis' in window }
}
