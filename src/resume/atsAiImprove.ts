import { RESUME_AI_FUNCTION, RESUME_AI_TIMEOUT_MS, RESUME_TEXT_MAX } from './aiModel.ts'
import { formatResumeWithTemplate, parseResumeForTemplate, type AtsTemplateId } from './atsTemplates.ts'

export const ATS_AI_IMPROVE_MODE = 'ats_improve'

export type AtsAiImproveInput = {
  resumeText: string
  jobDescription?: string
  templateId: AtsTemplateId
  matchedSkills?: string[]
  missingSkills?: string[]
  suggestions?: string[]
}

export type AtsAiImproveOutcome =
  | { ok: true; text: string; source: 'ai' | 'local'; coachingNotes: string[] }
  | { ok: false; reason: 'unavailable' | 'empty' }

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function jdTokens(jobDescription: string) {
  return jobDescription
    .toLowerCase()
    .split(/[^a-z0-9+#./]+/)
    .filter((token) => token.length >= 3)
}

function bulletRelevance(bullet: string, jobDescription: string, matched: string[]) {
  const lower = bullet.toLowerCase()
  let score = 0
  for (const skill of matched) {
    if (skill && lower.includes(skill.toLowerCase())) score += 4
  }
  for (const token of jdTokens(jobDescription).slice(0, 40)) {
    if (lower.includes(token)) score += 1
  }
  if (/\d|%|users|latency|cost|saved|improved|reduced|increased/i.test(bullet)) score += 2
  return score
}

function polishBullet(line: string) {
  let text = line.replace(/^[-*•▪▸►◦\d.)\s]+/, '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  text = text.replace(/^(responsible for|worked on|helped with)\s+/i, '')
  if (/^[a-z]/.test(text)) text = text[0]!.toUpperCase() + text.slice(1)
  if (!/[.!?]$/.test(text)) text += '.'
  return text.slice(0, 220)
}

function inferTargetRole(jobDescription: string, missingSkills: string[]) {
  const text = jobDescription.trim()
  if (!text) return missingSkills[0] ? `${missingSkills[0]} roles` : 'target roles'
  const titled =
    text.match(
      /\b((?:Senior\s+|Lead\s+)?(?:SAP\s+)?(?:UI5|Fiori|ABAP|DevOps|Software|Full[\s-]?Stack|Frontend|Backend|Cloud|Platform)\s+(?:Developer|Engineer|Consultant|Architect))\b/i,
    )?.[1] ?? text.match(/\b(SAP\s+UI5(?:\s+Development)?)\b/i)?.[1]
  return titled?.trim() || (missingSkills[0] ? `${missingSkills[0]} roles` : 'target roles')
}

function buildCleanResume(parts: {
  name: string
  contact: string
  summary: string
  skillsLine: string
  experience: string[]
  education: string[]
  templateId: AtsTemplateId
  impactFirst?: boolean
}) {
  const experienceBlock =
    parts.experience.length > 0
      ? parts.experience.map((line) => `• ${line}`).join('\n')
      : '• Add 3–5 role bullets with tools and outcomes.'
  const educationBlock =
    parts.education.length > 0 ? parts.education.map((line) => `• ${line}`).join('\n') : '• Degree, school, year'

  if (parts.templateId === 'compact') {
    return [
      parts.name,
      parts.contact,
      '',
      'SKILLS',
      parts.skillsLine,
      '',
      'SUMMARY',
      parts.summary,
      '',
      'EXPERIENCE',
      experienceBlock,
      '',
      'EDUCATION',
      educationBlock,
    ].join('\n')
  }

  if (parts.templateId === 'impact' || parts.impactFirst) {
    const impact =
      parts.experience
        .filter((line) => /\d|%|users|latency|cost|saved|improved|reduced|increased/i.test(line))
        .slice(0, 4)
        .map((line) => `• ${line}`)
        .join('\n') || experienceBlock
    return [
      parts.name,
      parts.contact,
      '',
      'KEY IMPACT',
      impact,
      '',
      'SUMMARY',
      parts.summary,
      '',
      'SKILLS',
      parts.skillsLine,
      '',
      'EXPERIENCE',
      experienceBlock,
      '',
      'EDUCATION',
      educationBlock,
    ].join('\n')
  }

  return [
    parts.name,
    parts.contact,
    '',
    'SUMMARY',
    parts.summary,
    '',
    'SKILLS',
    parts.skillsLine,
    '',
    'EXPERIENCE',
    experienceBlock,
    '',
    'EDUCATION',
    educationBlock,
  ].join('\n')
}

/** Stronger local rewrite — clean resume body + separate coaching notes. */
export function improveResumeLocally(input: AtsAiImproveInput): { text: string; coachingNotes: string[] } {
  const parsed = parseResumeForTemplate(input.resumeText)
  const matched = (input.matchedSkills ?? []).filter(Boolean)
  const missing = (input.missingSkills ?? []).filter(Boolean)
  const jd = (input.jobDescription ?? '').trim()
  const hasJd = jd.length >= 40

  const polishedExperience = parsed.experience
    .map(polishBullet)
    .filter(Boolean)
    .sort((a, b) => (hasJd ? bulletRelevance(b, jd, matched) - bulletRelevance(a, jd, matched) : 0))
    .slice(0, 8)

  const target = hasJd ? inferTargetRole(jd, missing) : ''
  const strengths = (matched.length ? matched : parsed.skills).slice(0, 7).join(', ')
  const years = input.resumeText.match(/\b(\d+\+?\s+years?)\b/i)?.[1]
  const contact = parsed.contact.join(' · ') || 'Add email · phone · LinkedIn'

  // Real resume summary — no “gap vs JD” meta language inside the document.
  const summary = hasJd
    ? [
        `${target.replace(/ roles$/i, '')} candidate${years ? ` with ${years} of experience` : ''}.`,
        strengths
          ? `Skilled in ${strengths}, with hands-on delivery across production systems.`
          : 'Focused on shipping reliable software and collaborating across teams.',
        'Open to applying transferable engineering strengths to this role’s stack.',
      ].join(' ')
    : [
        polishBullet(parsed.summary) ||
          `Results-focused ${parsed.skills.slice(0, 1)[0] || 'engineer'} profile${years ? ` with ${years} of experience` : ''}.`,
        parsed.skills.length ? `Core tools include ${parsed.skills.slice(0, 8).join(', ')}.` : null,
      ]
        .filter(Boolean)
        .join(' ')

  // Skills list looks like a real resume — matched tools first when JD mode.
  const skillsLine = hasJd
    ? [...matched, ...parsed.skills.filter((skill) => !matched.some((item) => item.toLowerCase() === skill.toLowerCase()))]
        .slice(0, 22)
        .join(', ') || 'Add technical skills'
    : parsed.skills.join(', ') || 'Add technical skills'

  const text = buildCleanResume({
    name: parsed.name,
    contact,
    summary,
    skillsLine,
    experience: polishedExperience,
    education: parsed.education.map(polishBullet).filter(Boolean),
    templateId: input.templateId,
  })

  const coachingNotes: string[] = []
  if (hasJd) {
    for (const skill of missing.slice(0, 5)) {
      coachingNotes.push(`Add a project/role bullet that proves ${skill} before listing it as a skill.`)
    }
    if (matched.length) {
      coachingNotes.push(`Lead with these overlapping tools in interviews: ${matched.slice(0, 6).join(', ')}.`)
    }
  } else {
    coachingNotes.push('Keep bullets under ~2 lines with a tool + outcome.')
    coachingNotes.push('Add 1–2 metrics (%, users, latency, cost) under recent roles.')
  }
  for (const item of input.suggestions ?? []) {
    if (!coachingNotes.some((note) => note.includes(item.slice(0, 24)))) coachingNotes.push(item)
    if (coachingNotes.length >= 8) break
  }

  // Keep a copyable plain-text package with coaching separated for optional export.
  const withNotes =
    coachingNotes.length > 0 ? `${text}\n\nCOACHING NOTES\n${coachingNotes.map((note) => `• ${note}`).join('\n')}` : text

  if (!hasJd && input.templateId) {
    // Ensure template layout still applies for resume-only polish.
    const formatted = formatResumeWithTemplate(text, input.templateId, { suggestions: [] })
    return {
      text: coachingNotes.length
        ? `${formatted}\n\nCOACHING NOTES\n${coachingNotes.map((note) => `• ${note}`).join('\n')}`
        : formatted,
      coachingNotes,
    }
  }

  return { text: withNotes, coachingNotes }
}

async function requestRemoteAtsImprove(input: AtsAiImproveInput): Promise<string | null> {
  try {
    const { supabase } = await import('../lib/supabase.ts')
    const invoke = supabase.functions.invoke(RESUME_AI_FUNCTION, {
      body: {
        mode: ATS_AI_IMPROVE_MODE,
        resume_text: input.resumeText.trim().slice(0, RESUME_TEXT_MAX),
        job_description: (input.jobDescription ?? '').trim().slice(0, 12_000),
        template_id: input.templateId,
        matched_skills: (input.matchedSkills ?? []).slice(0, 12),
        missing_skills: (input.missingSkills ?? []).slice(0, 12),
        suggestions: (input.suggestions ?? []).slice(0, 8),
      },
    })
    const { data, error } = await withTimeout(invoke, RESUME_AI_TIMEOUT_MS)
    if (error || data == null) return null
    if (typeof data === 'object' && data != null && 'error' in data) return null
    const text =
      typeof data === 'object' && data != null && 'improved_text' in data
        ? String((data as { improved_text?: unknown }).improved_text ?? '')
        : typeof data === 'object' && data != null && 'improvedText' in data
          ? String((data as { improvedText?: unknown }).improvedText ?? '')
          : ''
    const cleaned = text.trim()
    return cleaned.length >= 80 ? cleaned.slice(0, RESUME_TEXT_MAX) : null
  } catch {
    return null
  }
}

/** Spend-backed improve: prefer remote AI, always fall back to local rewrite. */
export async function requestAtsAiImprove(input: AtsAiImproveInput): Promise<AtsAiImproveOutcome> {
  if (input.resumeText.trim().length < 60) return { ok: false, reason: 'empty' }
  const remote = await requestRemoteAtsImprove(input)
  if (remote) {
    return { ok: true, text: remote, source: 'ai', coachingNotes: [] }
  }
  const local = improveResumeLocally(input)
  if (local.text.trim().length < 80) return { ok: false, reason: 'unavailable' }
  return { ok: true, text: local.text, source: 'local', coachingNotes: local.coachingNotes }
}
