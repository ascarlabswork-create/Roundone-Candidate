import { useEffect } from 'react'

let lockCount = 0
let savedOverflow: string | null = null
let savedPaddingRight: string | null = null

function scrollbarGutterPx() {
  return window.innerWidth - document.documentElement.clientWidth
}

export function lockBodyScroll() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow
    savedPaddingRight = document.body.style.paddingRight
    const gutter = scrollbarGutterPx()
    if (gutter > 0) {
      document.body.style.paddingRight = `${gutter}px`
    }
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
}

export function unlockBodyScroll() {
  if (lockCount <= 0) return
  lockCount -= 1
  if (lockCount !== 0) return
  document.body.style.overflow = savedOverflow ?? ''
  document.body.style.paddingRight = savedPaddingRight ?? ''
  savedOverflow = null
  savedPaddingRight = null
}

/** Re-applies or clears body scroll lock based on active lock holders (fixes stale `overflow: hidden`). */
export function syncBodyScrollLock() {
  if (lockCount > 0) {
    document.body.style.overflow = 'hidden'
    return
  }
  document.body.style.overflow = savedOverflow ?? ''
  document.body.style.paddingRight = savedPaddingRight ?? ''
  if (!savedOverflow) document.body.style.removeProperty('overflow')
  if (!savedPaddingRight) document.body.style.removeProperty('padding-right')
  savedOverflow = null
  savedPaddingRight = null
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [active])
}
