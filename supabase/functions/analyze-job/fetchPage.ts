import { assertPublicResolution, checkJobUrl, type UrlCheck } from './ssrf.ts'

export const JOB_FETCH_TIMEOUT_MS = 8000
export const JOB_FETCH_MAX_BYTES = 1_000_000
export const JOB_FETCH_MAX_REDIRECTS = 3
export const JOB_FETCH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export class JobFetchError extends Error {
  reason: 'invalid_url' | 'unsupported_url' | 'timeout' | 'unreadable'

  constructor(reason: JobFetchError['reason']) {
    super(reason)
    this.reason = reason
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export async function fetchPublicJobPage(
  rawUrl: string,
  options?: {
    fetchImpl?: FetchLike
    resolveHost?: (hostname: string) => Promise<string[]>
    timeoutMs?: number
  },
): Promise<{ url: string; html: string }> {
  const checked = await validate(rawUrl, options?.resolveHost)
  if (!checked.ok) throw new JobFetchError(checked.reason)
  return follow(checked.url, options?.fetchImpl ?? fetch, options?.resolveHost, options?.timeoutMs ?? JOB_FETCH_TIMEOUT_MS, 0)
}

async function validate(rawUrl: string, resolveHost?: (hostname: string) => Promise<string[]>): Promise<UrlCheck> {
  const checked = checkJobUrl(rawUrl)
  if (!checked.ok) return checked
  return assertPublicResolution(checked.url, resolveHost)
}

async function follow(
  url: URL,
  fetchImpl: FetchLike,
  resolveHost: ((hostname: string) => Promise<string[]>) | undefined,
  timeoutMs: number,
  redirects: number,
): Promise<{ url: string; html: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetchImpl(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': JOB_FETCH_USER_AGENT,
      },
    })
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    throw new JobFetchError(aborted ? 'timeout' : 'unreadable')
  } finally {
    clearTimeout(timer)
  }

  if (response.status >= 300 && response.status < 400) {
    if (redirects >= JOB_FETCH_MAX_REDIRECTS) throw new JobFetchError('unreadable')
    const location = response.headers.get('location')
    if (!location) throw new JobFetchError('unreadable')
    let next: URL
    try {
      next = new URL(location, url)
    } catch {
      throw new JobFetchError('invalid_url')
    }
    const nextCheck = await validate(next.toString(), resolveHost)
    if (!nextCheck.ok) throw new JobFetchError(nextCheck.reason)
    return follow(nextCheck.url, fetchImpl, resolveHost, timeoutMs, redirects + 1)
  }

  if (!response.ok) throw new JobFetchError('unreadable')
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
    throw new JobFetchError('unreadable')
  }
  const length = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(length) && length > JOB_FETCH_MAX_BYTES) throw new JobFetchError('unreadable')
  const html = await readLimited(response, JOB_FETCH_MAX_BYTES)
  if (!html.trim()) throw new JobFetchError('unreadable')
  return { url: url.toString(), html }
}

async function readLimited(response: Response, maxBytes: number) {
  if (!response.body) {
    const text = await response.text()
    if (text.length > maxBytes) throw new JobFetchError('unreadable')
    return text
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new JobFetchError('unreadable')
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(concat(chunks, total))
}

function concat(chunks: Uint8Array[], total: number) {
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
