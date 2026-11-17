import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * SPA navigations keep the previous scroll offset. Reset to the top on every
 * route change so Home / sidebar destinations / Welcome → Home land correctly.
 * Hash links (e.g. /#demo) still jump to the matching section.
 */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useLayoutEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.replace(/^#/, ''))
      if (id) {
        const target = document.getElementById(id)
        if (target) {
          target.scrollIntoView()
          return
        }
      }
    }

    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    // In case a nested pane is the scroll container (overflow-auto regions).
    const main = document.querySelector('main')
    if (main instanceof HTMLElement) {
      main.scrollTop = 0
    }
  }, [pathname, search, hash])

  return null
}
