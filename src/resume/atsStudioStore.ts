import type { AtsTemplateId } from './atsTemplates.ts'

export const ATS_STUDIO_STORAGE_KEY = 'jobround.ats_studio.v1'

export type AtsStudioPayload = {
  resumeText: string
  jobText: string
  mode: 'resume' | 'jd'
  templateId: AtsTemplateId
  draftText: string
  aiDraft?: string
  matchedSkills?: string[]
  missingSkills?: string[]
  suggestions?: string[]
}

export function saveAtsStudioPayload(payload: AtsStudioPayload) {
  try {
    sessionStorage.setItem(ATS_STUDIO_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* private mode */
  }
}

export function loadAtsStudioPayload(): AtsStudioPayload | null {
  try {
    const raw = sessionStorage.getItem(ATS_STUDIO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AtsStudioPayload
    if (!parsed || typeof parsed.resumeText !== 'string' || typeof parsed.draftText !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function clearAtsStudioPayload() {
  try {
    sessionStorage.removeItem(ATS_STUDIO_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
