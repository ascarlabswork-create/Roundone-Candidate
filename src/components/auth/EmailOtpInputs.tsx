import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn.ts'

const LENGTH = 6

export function EmailOtpInputs({
  value,
  disabled,
  onChange,
  idPrefix = 'otp',
}: {
  value: string
  disabled?: boolean
  onChange: (next: string) => void
  idPrefix?: string
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: LENGTH }, (_, index) => value[index] ?? '')

  useEffect(() => {
    if (!disabled) refs.current[0]?.focus()
    // Focus the first box when the OTP step mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setAt(index: number, char: string) {
    const next = digits.map((digit, i) => (i === index ? char : digit))
    onChange(next.join('').replace(/\D/g, '').slice(0, LENGTH))
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!pasted) return
    onChange(pasted)
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      setAt(index - 1, '')
      refs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      refs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      event.preventDefault()
      refs.current[index + 1]?.focus()
    }
  }

  return (
    <div className="flex justify-between gap-2 sm:gap-2.5" role="group" aria-label="6-digit verification code">
      {digits.map((digit, index) => (
        <input
          key={`${idPrefix}-${index}`}
          ref={(node) => {
            refs.current[index] = node
          }}
          id={index === 0 ? `${idPrefix}-0` : undefined}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={digit}
          aria-label={`Digit ${index + 1}`}
          onPaste={handlePaste}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onChange={(event) => {
            const char = event.target.value.replace(/\D/g, '').slice(-1)
            setAt(index, char)
            if (char && index < LENGTH - 1) refs.current[index + 1]?.focus()
          }}
          className={cn(
            'h-12 w-10 rounded-xl border bg-white text-center text-lg font-semibold text-navy-950 outline-none transition sm:h-14 sm:w-12',
            'focus:border-navy-800 focus:ring-2 focus:ring-navy-800/15',
            digit ? 'border-navy-800' : 'border-slate-300',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        />
      ))}
    </div>
  )
}
