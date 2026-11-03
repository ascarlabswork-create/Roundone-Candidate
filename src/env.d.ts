/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Direct URL or site path to MP4/WebM product demo (e.g. /demo/product-demo.mp4). */
  readonly VITE_DEMO_VIDEO_URL?: string
  /** YouTube video ID for embedded demo (takes precedence over file URL). */
  readonly VITE_DEMO_VIDEO_YOUTUBE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
