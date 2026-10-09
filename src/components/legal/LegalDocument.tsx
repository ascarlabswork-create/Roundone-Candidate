import { Link } from 'react-router-dom'
import { LEGAL_LAST_UPDATED, LEGAL_LINKS, type LegalSection } from '../../legal/legalCopy.ts'

export function LegalDocument({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Draft for company and legal review</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated {LEGAL_LAST_UPDATED}</p>
      <div className="mt-8 space-y-8 text-sm leading-6 text-slate-700">
        {sections.map((section) => (
          <section key={section.heading} id={section.id} className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-navy-950">{section.heading}</h2>
            <div className="mt-3 space-y-3">
              {section.blocks.map((block, index) => {
                if (block.type === 'ul') {
                  return (
                    <ul key={index} className="list-disc space-y-2 pl-5">
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )
                }
                if (block.type === 'note') {
                  return (
                    <p key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
                      {block.text}
                    </p>
                  )
                }
                return <p key={index}>{block.text}</p>
              })}
            </div>
          </section>
        ))}
      </div>
      <nav aria-label="Other legal information" className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-6 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5">
        {LEGAL_LINKS.map((item) => (
          <Link key={item.to} to={item.to} className="text-slate-600 underline-offset-2 hover:text-navy-950 hover:underline">
            {item.label}
          </Link>
        ))}
      </nav>
    </article>
  )
}
