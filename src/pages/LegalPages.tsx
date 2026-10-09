import { LegalDocument } from '../components/legal/LegalDocument.tsx'
import {
  contactSections,
  pricingSections,
  privacySections,
  refundSections,
  termsSections,
} from '../legal/legalCopy.ts'

export function PrivacyPage() {
  return <LegalDocument title="Privacy Policy" sections={privacySections} />
}

export function TermsPage() {
  return <LegalDocument title="Terms of Service" sections={termsSections} />
}

export function RefundPolicyPage() {
  return <LegalDocument title="Refund & Cancellation Policy" sections={refundSections} />
}

export function PricingTermsPage() {
  return <LegalDocument title="Pricing & Billing Terms" sections={pricingSections} />
}

export function ContactPage() {
  return <LegalDocument title="Contact Us" sections={contactSections} />
}
