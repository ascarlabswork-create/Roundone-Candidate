import mammoth from 'mammoth'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/** Accept any resume file; extraction handles common formats. */
export const RESUME_ACCEPT = '*/*'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TEXT_CHARS = 14_000

function looksLikeText(name: string, type: string) {
  return (
    type.startsWith('text/') ||
    type === 'application/rtf' ||
    type === 'application/msword' ||
    /\.(txt|md|markdown|text|rtf|csv)$/i.test(name)
  )
}

function looksLikeDocx(name: string, type: string) {
  return (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.docx$/i.test(name)
  )
}

function looksLikeLegacyDoc(name: string, type: string) {
  return type === 'application/msword' || /\.doc$/i.test(name)
}

/**
 * Extract plain text from an uploaded resume file entirely on the client.
 * Supports PDF, Word (.docx), and plain-text files. Other uploads are read as
 * text when possible.
 */
export async function extractResumeText(file: File): Promise<string> {
  const name = file.name || ''
  const type = file.type || ''

  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That file is too large. Please upload a resume under 8 MB.')
  }

  if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
    return extractPdfText(file)
  }

  if (looksLikeDocx(name, type)) {
    return extractDocxText(file)
  }

  if (looksLikeLegacyDoc(name, type) && !/\.docx$/i.test(name)) {
    throw new Error(
      'Older .doc Word files are not supported. Please save as .docx or PDF and upload again.',
    )
  }

  if (looksLikeText(name, type)) {
    return normalize(await file.text())
  }

  // Any other file: best-effort text read (covers renamed text files, etc.).
  try {
    const text = normalize(await file.text())
    if (text && !looksBinary(text)) return text
  } catch {
    // fall through
  }

  throw new Error(
    'We could not read text from that file. Please upload a PDF, Word (.docx), or text resume.',
  )
}

function looksBinary(text: string) {
  const sample = text.slice(0, 2000)
  if (!sample) return true
  let suspicious = 0
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i)
    if (code === 0 || (code < 9 && code !== 10 && code !== 13)) suspicious += 1
  }
  return suspicious / sample.length > 0.05
}

function normalize(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS)
}

async function extractDocxText(file: File): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    const text = normalize(result.value || '')
    if (!text) {
      throw new Error('We could not read any text from that Word file. Please try a PDF instead.')
    }
    return text
  } catch (error) {
    if (error instanceof Error && /could not read any text/i.test(error.message)) throw error
    throw new Error('Could not read that Word file. Please try a PDF or .docx resume.')
  }
}

async function extractPdfText(file: File): Promise<string> {
  // Static import avoids a separate dynamic chunk that can 404 after redeploys
  // when a cached page still points at an old hashed asset URL.
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  try {
    const data = new Uint8Array(await file.arrayBuffer())
    const loadingTask = pdfjs.getDocument({ data })
    const pdf = await loadingTask.promise
    const parts: string[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => (typeof (item as { str?: unknown }).str === 'string' ? (item as { str: string }).str : ''))
        .join(' ')
      parts.push(pageText)
      if (parts.join(' ').length > MAX_TEXT_CHARS * 2) break
    }

    const text = normalize(parts.join('\n'))
    if (!text) {
      throw new Error(
        'We could not read any text from that PDF (it may be a scanned image). Please paste the resume text or try another file.',
      )
    }
    return text
  } catch (error) {
    if (error instanceof Error && /scanned image|paste the resume|another file/i.test(error.message)) {
      throw error
    }
    throw new Error('Could not read that PDF. Please refresh and try again, or upload a Word or text resume.')
  }
}
