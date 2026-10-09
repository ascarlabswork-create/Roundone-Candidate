import {
  COMPANY_LEGAL_NAME,
  COPYRIGHT_NOTICE,
  LEGAL_LINKS,
  contactSections,
  pricingSections,
  privacySections,
  refundSections,
} from './legalCopy.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function textOf(sections: { heading: string; blocks: Array<{ type: string; text?: string; items?: string[] }> }[]) {
  return sections
    .flatMap((section) => [section.heading, ...section.blocks.flatMap((block) => (block.type === 'ul' ? (block.items ?? []) : [block.text ?? '']))])
    .join('\n')
}

const paths = LEGAL_LINKS.map((item) => item.to)
expect(paths.includes('/privacy'), 'privacy route')
expect(paths.includes('/terms'), 'terms route')
expect(paths.includes('/refund-policy'), 'refund route')
expect(paths.includes('/pricing'), 'pricing route')
expect(paths.includes('/contact'), 'contact route')
expect(paths.includes('/contact#personal-data'), 'personal-data link')

expect(COPYRIGHT_NOTICE.includes(COMPANY_LEGAL_NAME), 'copyright names the company')
expect(COPYRIGHT_NOTICE.includes('2026'), 'copyright year is fixed')

const privacy = textOf(privacySections)
expect(privacy.includes('Digital Personal Data Protection Act, 2023'), 'privacy cites the Act')
expect(privacy.includes('does not start by itself'), 'recording is not automatic')
expect(!/ISO|SOC 2|certified/i.test(privacy), 'privacy does not claim a certification')
expect(privacy.includes('does not claim that the provider never stores'), 'AI retention is not promised')

const pricing = textOf(pricingSections)
expect(pricing.includes('does not charge a card'), 'pricing says payment is not live')
expect(pricing.includes('greater of ₹49 and 5%'), 'pricing matches the fee calculation')

const refund = textOf(refundSections)
expect(refund.includes('does not create a refund'), 'captured payments are not auto-refunded')
expect(refund.includes('Pending company approval') || refund.includes('Needs company approval') || refund.includes('company still needs to approve'), 'refund gaps are flagged')

const contact = textOf(contactSections)
expect(!contact.includes('@'), 'contact does not invent an email address')
expect(!/\+91|\b\d{10}\b/.test(contact), 'contact does not invent a phone number')
expect(contact.includes('Needs company approval'), 'missing contact details are marked')
expect(contactSections.some((section) => section.id === 'personal-data'), 'personal-data section exists')

console.log('legalCopy.check passed')
