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
  | { ok: true; text: string; source: 'ai' | 'local' }
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

/** Stronger local rewrite used as the AI improve result (and as remote fallback). */
export function improveResumeLocally(input: AtsAiImproveInput): string {
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

  const summary = hasJd
    ? [
        `Applying for ${target}${years ? ` with ${years} of relevant experience` : ''}.`,
        strengths ? `Closest strengths on this resume: ${strengths}.` : null,
        missing.length
          ? `To compete for this JD, add proven evidence for: ${missing.slice(0, 5).join(', ')}.`
          : 'Keyword coverage looks solid — keep bullets concrete and ATS-friendly.',
      ]
        .filter(Boolean)
        .join(' ')
    : [
        polishBullet(parsed.summary) ||
          `Results-focused ${parsed.skills.slice(0, 1)[0] || 'engineer'} profile${years ? ` with ${years} of experience` : ''}.`,
        parsed.skills.length ? `Core tools: ${parsed.skills.slice(0, 8).join(', ')}.` : null,
      ]
        .filter(Boolean)
        .join(' ')

  const rebuilt = [
    parsed.name,
    parsed.contact.join(' · ') || 'Add email · phone · LinkedIn',
    '',
    'SUMMARY',
    summary,
    '',
    'SKILLS',
    hasJd
      ? [
          matched.length ? `Matched to JD: ${matched.slice(0, 10).join(', ')}` : null,
          `Other skills: ${parsed.skills.filter((s) => !matched.some((m) => m.toLowerCase() === s.toLowerCase())).slice(0, 14).join(', ') || '—'}`,
          missing.length ? `Target keywords (add only with proof): ${missing.slice(0, 8).join(', ')}` : null,
        ]
          .filter(Boolean)
          .join('\n')
      : parsed.skills.join(', ') || 'Add technical skills',
    '',
    hasJd ? 'EXPERIENCE (prioritized for this JD)' : 'EXPERIENCE',
    polishedExperience.length
      ? polishedExperience.map((line) => `• ${line}`).join('\n')
      : '• Add 3–5 role bullets with tools and outcomes.',
    '',
    'EDUCATION',
    parsed.education.length
      ? parsed.education.map((line) => `• ${polishBullet(line)}`).join('\n')
      : '• Degree, school, year',
  ]

  if (hasJd) {
    rebuilt.push(
      '',
      'AI NEXT STEPS FOR THIS JD',
      ...missing.slice(0, 4).map((skill) => `• Write one project/role bullet that proves ${skill}.`),
      ...(input.suggestions ?? [])
        .filter((item) => !missing.some((skill) => item.includes(skill)))
        .slice(0, 3)
        .map((item) => `• ${item}`),
    )
  } else {
    rebuilt.push(
      '',
      'AI POLISH NOTES',
      '• Keep bullets under ~2 lines with a tool + outcome.',
      '• Add 1–2 metrics (%, users, latency, cost) under recent roles.',
      ...(input.suggestions ?? []).slice(0, 3).map((item) => `• ${item}`),
    )
  }

  // Re-run through template formatter for layout consistency when no JD next-steps needed.
  if (!hasJd) {
    return formatResumeWithTemplate(rebuilt.join('\n'), input.templateId, {
      suggestions: input.suggestions,
    })
  }

  if (input.templateId === 'compact') {
    return [
      parsed.name,
      parsed.contact.join(' · ') || 'Add email · phone · LinkedIn',
      '',
      'SKILLS',
      hasJd
        ? [
            matched.length ? `Matched to JD: ${matched.slice(0, 10).join(', ')}` : null,
            `Other skills: ${parsed.skills.slice(0, 14).join(', ')}`,
            missing.length ? `Target keywords (add only with proof): ${missing.slice(0, 8).join(', ')}` : null,
          ]
            .filter(Boolean)
            .join('\n')
        : parsed.skills.join(' · '),
      '',
      'SUMMARY',
      summary,
      '',
      'EXPERIENCE',
      polishedExperience.map((line) => `• ${line}`).join('\n'),
      '',
      'EDUCATION',
      parsed.education.map((line) => `• ${polishBullet(line)}`).join('\n') || '• Degree, school, year',
      '',
      ...rebuilt.slice(rebuilt.indexOf('AI NEXT STEPS FOR THIS JD')),
    ].join('\n')
  }

  return rebuilt.join('\n')
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
  if (remote) return { ok: true, text: remote, source: 'ai' }
  const local = improveResumeLocally(input).trim()
  if (local.length < 80) return { ok: false, reason: 'unavailable' }
  return { ok: true, text: local, source: 'local' }
}
