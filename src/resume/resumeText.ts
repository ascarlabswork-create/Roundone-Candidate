import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/** File types accepted by the resume upload control. */
export const RESUME_ACCEPT = '.pdf,.txt,.md,.markdown,text/plain,application/pdf'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TEXT_CHARS = 14_000

function looksLikeText(name: string, type: string) {
  return type.startsWith('text/') || /\.(txt|md|markdown|text)$/i.test(name)
}

/**
 * Extract plain text from an uploaded resume file entirely on the client.
 * Supports PDF (via pdf.js) and plain-text files. Binary formats we cannot
 * reliably parse in the browser (e.g. .docx) throw a friendly error asking the
 * candidate to paste the text instead.
 */
export async function extractResumeText(file: File): Promise<string> {
  const name = file.name || ''
  const type = file.type || ''

  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That file is too large. Please upload a resume under 8 MB, or paste the text below.')
  }

  if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
    return extractPdfText(file)
  }

  if (looksLikeText(name, type)) {
    const text = await file.text()
    return normalize(text)
  }

  throw new Error(
    'Unsupported file type. Please upload a PDF or plain-text (.txt) resume, or paste the text below.',
  )
}

function normalize(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS)
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  // The worker is emitted as a separate asset by Vite (?url import).
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

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
      'We could not read any text from that PDF (it may be a scanned image). Please paste the resume text below instead.',
    )
  }
  return text
}
