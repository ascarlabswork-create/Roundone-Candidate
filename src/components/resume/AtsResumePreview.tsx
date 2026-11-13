import { cn } from '../../lib/cn.ts'

export type ResumePreviewSection = {
  title: string
  lines: string[]
}

export type ResumePreviewModel = {
  name: string
  contact: string
  sections: ResumePreviewSection[]
}

const SECTION_TITLES =
  /^(SUMMARY|PROFESSIONAL SUMMARY|SKILLS|TECHNICAL SKILLS|EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EXPERIENCE \(PRIORITIZED FOR THIS JD\)|KEY IMPACT|EDUCATION|PROJECTS|CERTIFICATIONS|NEXT STEPS FOR THIS JD|AI NEXT STEPS FOR THIS JD|AI POLISH NOTES|COACHING NOTES)$/i

function isMetaSection(title: string) {
  return /next steps|polish notes|coaching notes/i.test(title)
}

function cleanSectionTitle(title: string) {
  return title.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Parse plain ATS text into a resume-like preview model. */
export function parseResumePreview(text: string): ResumePreviewModel {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))

  let name = 'Your Name'
  let contact = ''
  const sections: ResumePreviewSection[] = []
  let current: ResumePreviewSection | null = null
  let sawName = false

  for (const line of lines) {
    if (!sawName && line && !SECTION_TITLES.test(line)) {
      name = line
      sawName = true
      continue
    }

    if (sawName && !current && /@|linkedin|\+?\d[\d\s().-]{6,}|·/.test(line) && !SECTION_TITLES.test(line)) {
      contact = contact ? `${contact} · ${line}` : line
      continue
    }

    if (SECTION_TITLES.test(line)) {
      current = { title: cleanSectionTitle(line), lines: [] }
      sections.push(current)
      continue
    }

    if (!current) {
      if (line && !/@|linkedin|\+?\d/.test(line)) {
        current = { title: 'SUMMARY', lines: [line] }
        sections.push(current)
      }
      continue
    }

    if (line) current.lines.push(line)
  }

  return { name, contact, sections }
}

function renderLine(line: string, sectionTitle: string) {
  const stripped = line.replace(/^[-*•▪▸►◦]\s*/, '')
  const forceBullet =
    /^[-*•▪▸►◦]\s+/.test(line) || /EXPERIENCE|EDUCATION|IMPACT|PROJECT/i.test(sectionTitle)

  if (forceBullet) {
    return (
      <p key={line} className="flex gap-2.5">
        <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" aria-hidden />
        <span>{stripped}</span>
      </p>
    )
  }

  return <p key={line}>{line}</p>
}

export function AtsResumePreview({
  text,
  className,
  showMeta = true,
}: {
  text: string
  className?: string
  showMeta?: boolean
}) {
  const model = parseResumePreview(text)
  const bodySections = model.sections.filter((section) => !isMetaSection(section.title))
  const metaSections = model.sections.filter((section) => isMetaSection(section.title))

  return (
    <div className={cn('ats-resume-sheet', className)}>
      <article className="ats-resume-paper mx-auto max-w-3xl bg-white px-6 py-7 sm:px-10 sm:py-10">
        <header className="border-b border-slate-300 pb-4 text-center">
          <h3 className="font-serif text-2xl font-semibold tracking-tight text-navy-950 sm:text-[1.75rem]">{model.name}</h3>
          {model.contact ? <p className="mt-2 text-xs leading-5 text-slate-600 sm:text-sm">{model.contact}</p> : null}
        </header>

        <div className="mt-6 space-y-5">
          {bodySections.map((section) => (
            <section key={section.title}>
              <h4 className="border-b border-navy-950/20 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-navy-950">
                {section.title}
              </h4>
              <div className="mt-2.5 space-y-1.5 text-[13px] leading-6 text-slate-800">
                {section.lines.map((line) => renderLine(line, section.title))}
              </div>
            </section>
          ))}
        </div>
      </article>

      {showMeta && metaSections.length > 0 ? (
        <div className="ats-coach-notes mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-950">Coaching notes (not part of resume)</p>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-950/90">
            {metaSections.flatMap((section) =>
              section.lines.map((line) => (
                <li key={`${section.title}-${line}`}>• {line.replace(/^[-*•]\s*/, '')}</li>
              )),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
