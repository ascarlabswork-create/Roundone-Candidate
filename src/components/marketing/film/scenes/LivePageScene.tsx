import { useEffect, useRef } from 'react'

export function LivePageScene({ path, baseOrigin }: { path: string; baseOrigin: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const url = new URL(path, baseOrigin)
    iframe.src = url.toString()
  }, [path, baseOrigin])

  return (
    <iframe
      ref={iframeRef}
      title="JobRound.ai live product"
      className="h-[1200px] w-full border-0 bg-white"
      loading="eager"
    />
  )
}
