import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardCopy,
  Coins,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react'
import {
  AtsResumePreview,
  isMetaSection,
  parseResumePreview,
  serializeResumePreview,
  type ResumePreviewModel,
} from '../components/resume/AtsResumePreview.tsx'
import { Button } from '../components/ui/Button.tsx'
import { FieldLabel, TextArea, TextInput } from '../components/ui/primitives.tsx'
import { ATS_AI_IMPROVE_COST, canSpendAiCredits, getAiCredits, refundAiCredits, spendAiCredits } from '../resume/aiCredits.ts'
import { requestAtsAiImprove } from '../resume/atsAiImprove.ts'
import { RESUME_TEXT_MAX } from '../resume/aiModel.ts'
import { loadAtsStudioPayload, saveAtsStudioPayload } from '../resume/atsStudioStore.ts'
import { ATS_TEMPLATES, formatResumeWithTemplate, type AtsTemplateId } from '../resume/atsTemplates.ts'

const SECTION_ORDER = ['SUMMARY', 'SKILLS', 'KEY IMPACT', 'EXPERIENCE', 'EDUCATION', 'PROJECTS', 'CERTIFICATIONS']

function sortSections(model: ResumePreviewModel) {
  const ranked = [...model.sections].sort((a, b) => {
    const ai = SECTION_ORDER.findIndex((title) => a.title.toUpperCase().startsWith(title))
    const bi = SECTION_ORDER.findIndex((title) => b.title.toUpperCase().startsWith(title))
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  return { ...model, sections: ranked }
}

export function AtsResumeStudioPage() {
  const navigate = useNavigate()
  const initial = useMemo(() => loadAtsStudioPayload(), [])
  const [templateId, setTemplateId] = useState<AtsTemplateId>(initial?.templateId ?? 'classic')
  const [draftText, setDraftText] = useState(initial?.draftText || initial?.resumeText || '')
  const [model, setModel] = useState(() => sortSections(parseResumePreview(draftText)))
  const [activeKey, setActiveKey] = useState<'name' | 'contact' | string>('SUMMARY')
  const [improving, setImproving] = useState(false)
  const [credits, setCredits] = useState(() => getAiCredits())
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    if (!initial?.resumeText && !initial?.draftText) {
      navigate('/candidate/ats-check', { replace: true })
    }
  }, [initial, navigate])

  const resumeOnlyText = useMemo(() => {
    const serialized = serializeResumePreview(model)
    return serialized.split(/\nCOACHING NOTES\n/i)[0]?.trim() ?? serialized
  }, [model])

  const sectionKeys = useMemo(() => {
    const keys = ['name', 'contact', ...model.sections.map((section) => section.title)]
    return keys
  }, [model.sections])

  useEffect(() => {
    if (!sectionKeys.includes(activeKey)) {
      setActiveKey(sectionKeys.includes('SUMMARY') ? 'SUMMARY' : (sectionKeys[0] ?? 'name'))
    }
  }, [activeKey, sectionKeys])

  function persist(nextDraft: string, nextTemplate = templateId) {
    if (!initial) return
    saveAtsStudioPayload({
      ...initial,
      templateId: nextTemplate,
      draftText: nextDraft,
      aiDraft: nextDraft,
    })
  }

  function applyModel(next: ResumePreviewModel) {
    const sorted = sortSections(next)
    setModel(sorted)
    const text = serializeResumePreview(sorted)
    setDraftText(text)
    persist(text)
  }

  function rebuildFromTemplate(nextTemplate: AtsTemplateId) {
    if (!initial) return
    setTemplateId(nextTemplate)
    const rebuilt = formatResumeWithTemplate(initial.resumeText, nextTemplate, {
      missingJobSkills: initial.missingSkills?.slice(0, 8) ?? [],
      matchedJobSkills: initial.matchedSkills?.slice(0, 8) ?? [],
      jobDescription: initial.mode === 'jd' ? initial.jobText : '',
      suggestions: initial.suggestions?.slice(0, 6) ?? [],
    })
    setDraftText(rebuilt)
    setModel(sortSections(parseResumePreview(rebuilt)))
    persist(rebuilt, nextTemplate)
    setInfo(`Applied ${ATS_TEMPLATES.find((item) => item.id === nextTemplate)?.name ?? 'template'}.`)
  }

  async function copyResume() {
    try {
      await navigator.clipboard.writeText(resumeOnlyText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy. Select the resume text manually.')
    }
  }

  function downloadResume() {
    const blob = new Blob([resumeOnlyText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'improved-resume.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function onImproveWithAi() {
    if (!initial) return
    if (!canSpendAiCredits(ATS_AI_IMPROVE_COST)) {
      setError(`You need ${ATS_AI_IMPROVE_COST} AI credits. You have ${getAiCredits()} left.`)
      setCredits(getAiCredits())
      return
    }
    if (!spendAiCredits(ATS_AI_IMPROVE_COST)) {
      setError(`You need ${ATS_AI_IMPROVE_COST} AI credits.`)
      setCredits(getAiCredits())
      return
    }
    setCredits(getAiCredits())
    setImproving(true)
    setError('')
    setInfo('')
    try {
      const outcome = await requestAtsAiImprove({
        resumeText: initial.resumeText,
        jobDescription: initial.mode === 'jd' ? initial.jobText : '',
        templateId,
        matchedSkills: initial.matchedSkills ?? [],
        missingSkills: initial.missingSkills ?? [],
        suggestions: initial.suggestions ?? [],
      })
      if (!outcome.ok) {
        refundAiCredits(ATS_AI_IMPROVE_COST)
        setCredits(getAiCredits())
        setError('AI improve could not finish. Credits refunded.')
        return
      }
      setDraftText(outcome.text)
      setModel(sortSections(parseResumePreview(outcome.text)))
      persist(outcome.text)
      setInfo(`AI rewrite ready (−${ATS_AI_IMPROVE_COST} credits). Edit any section on the left.`)
    } catch {
      refundAiCredits(ATS_AI_IMPROVE_COST)
      setCredits(getAiCredits())
      setError('AI improve failed. Credits refunded.')
    } finally {
      setImproving(false)
    }
  }

  function activeSectionBody() {
    if (activeKey === 'name') return model.name
    if (activeKey === 'contact') return model.contact
    return model.sections.find((section) => section.title === activeKey)?.lines.join('\n') ?? ''
  }

  function onSectionChange(value: string) {
    if (activeKey === 'name') {
      applyModel({ ...model, name: value.slice(0, 80) })
      return
    }
    if (activeKey === 'contact') {
      applyModel({ ...model, contact: value.slice(0, 180) })
      return
    }
    const lines = value.split(/\r?\n/)
    applyModel({
      ...model,
      sections: model.sections.map((section) =>
        section.title === activeKey ? { ...section, lines } : section,
      ),
    })
  }

  if (!initial) {
    return (
      <div className="px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-slate-600">No resume draft found.</p>
        <Link to="/candidate/ats-check" className="mt-3 inline-block font-medium text-coral-700 hover:underline">
          Back to ATS Check
        </Link>
      </div>
    )
  }

  return (
    <div className="ats-studio pb-16">
      <div className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/candidate/ats-check"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-navy-950 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to score
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">Resume studio</p>
              <h1 className="text-lg font-semibold text-navy-950 sm:text-xl">Browse templates & edit by section</h1>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-950">
            <Coins className="h-4 w-4" />
            {credits} AI credits
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-navy-950">Templates</h2>
              <p className="mt-1 text-sm text-slate-600">Pick a layout, then refine each section.</p>
            </div>
            <Button type="button" disabled={improving} onClick={() => void onImproveWithAi()} className="ats-ai-glow">
              <span className="inline-flex items-center gap-2">
                {improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {improving ? 'Improving…' : `Improve with AI (−${ATS_AI_IMPROVE_COST})`}
              </span>
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {ATS_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => rebuildFromTemplate(template.id)}
                className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${
                  templateId === template.id
                    ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                    : 'border-slate-200 hover:border-indigo-200'
                }`}
              >
                <p className="text-sm font-semibold text-navy-950">{template.name}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{template.blurb}</p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">{template.bestFor}</p>
              </button>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          {info ? <p className="mt-3 text-sm text-emerald-800">{info}</p> : null}
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-navy-950">Edit by section</p>
              <p className="mt-1 text-xs text-slate-600">Select a block, update it, preview updates live.</p>
              <div className="mt-3 flex flex-col gap-1.5">
                {sectionKeys.map((key) => {
                  const label = key === 'name' ? 'Name' : key === 'contact' ? 'Contact' : key
                  const meta = typeof key === 'string' && isMetaSection(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveKey(key)}
                      className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                        activeKey === key
                          ? 'bg-navy-950 text-white'
                          : meta
                            ? 'bg-amber-50 text-amber-950 hover:bg-amber-100'
                            : 'bg-slate-50 text-navy-950 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <FieldLabel htmlFor="section-editor">
                {activeKey === 'name' ? 'Name' : activeKey === 'contact' ? 'Contact' : activeKey}
              </FieldLabel>
              {activeKey === 'name' || activeKey === 'contact' ? (
                <TextInput
                  id="section-editor"
                  className="mt-1"
                  value={activeSectionBody()}
                  onChange={(event) => onSectionChange(event.target.value)}
                />
              ) : (
                <TextArea
                  id="section-editor"
                  className="mt-1 min-h-48"
                  value={activeSectionBody()}
                  onChange={(event) => onSectionChange(event.target.value.slice(0, RESUME_TEXT_MAX))}
                  placeholder="Edit this section…"
                />
              )}
              <p className="mt-2 text-xs text-slate-500">
                Tip: keep experience lines as bullets starting with • for a clean resume look.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={() => void copyResume()}>
                <ClipboardCopy className="h-4 w-4" />
                {copied ? 'Copied resume' : 'Copy resume'}
              </Button>
              <Button type="button" variant="outline" onClick={downloadResume}>
                <Download className="h-4 w-4" />
                Download .txt
              </Button>
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print / Save PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={improving}
                onClick={() => void onImproveWithAi()}
              >
                <RefreshCw className={`h-4 w-4 ${improving ? 'animate-spin' : ''}`} />
                Re-run AI (−{ATS_AI_IMPROVE_COST})
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  persist(draftText)
                  navigate('/candidate/ats-check')
                }}
              >
                <Sparkles className="h-4 w-4" />
                Save & return to ATS Check
              </Button>
            </div>
          </aside>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-100/80 p-3 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-navy-950">Live resume preview</p>
              <p className="text-xs text-slate-500">Full-page layout — no cramped panel</p>
            </div>
            <div className="ats-resume-stage overflow-auto rounded-xl p-3 sm:p-6">
              <AtsResumePreview text={draftText} showMeta />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
