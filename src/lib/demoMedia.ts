/** Optional hosted product demo (MP4/WebM). Set in `.env.local` as VITE_DEMO_VIDEO_URL. */
export function getDemoVideoUrl(): string | null {
  const fromEnv = import.meta.env.VITE_DEMO_VIDEO_URL?.trim()
  if (fromEnv) return fromEnv
  return '/demo/product-demo.mp4'
}

/** Optional YouTube embed (overrides file URL when set). VITE_DEMO_VIDEO_YOUTUBE_ID=abc123 */
export function getDemoYouTubeId(): string | null {
  const id = import.meta.env.VITE_DEMO_VIDEO_YOUTUBE_ID?.trim()
  return id || null
}

export function youtubeEmbedUrl(videoId: string, autoplay: boolean) {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  })
  if (autoplay) params.set('autoplay', '1')
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`
}
