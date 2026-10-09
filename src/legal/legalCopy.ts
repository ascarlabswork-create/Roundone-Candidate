export const COMPANY_LEGAL_NAME = 'Ascar Labs India Private Limited'
export const PRODUCT_NAME = 'jobround.ai'
export const LEGAL_LAST_UPDATED = '9 October 2026'

export const COPYRIGHT_NOTICE = `© 2026 ${COMPANY_LEGAL_NAME}. All rights reserved.`

export const LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/refund-policy', label: 'Refund & Cancellation Policy' },
  { to: '/pricing', label: 'Pricing & Billing Terms' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/contact#personal-data', label: 'Personal data requests' },
] as const

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'note'; text: string }

export type LegalSection = {
  id?: string
  heading: string
  blocks: LegalBlock[]
}

export const privacySections: LegalSection[] = [
  {
    heading: 'Who this draft is for',
    blocks: [
      {
        type: 'p',
        text: `${PRODUCT_NAME} (RoundOne) is operated by ${COMPANY_LEGAL_NAME}. This draft describes personal data the candidate application can process today. It is not a final privacy notice. Company and legal review is required before launch, including under the Digital Personal Data Protection Act, 2023 and the phased commencement of the Digital Personal Data Protection Rules, 2025.`,
      },
    ],
  },
  {
    heading: 'Account and profile data',
    blocks: [
      {
        type: 'p',
        text: 'When you create an account or edit your profile, the application can store your name, email address, phone number, headline, bio, target role, experience level, skills, preferences, and similar profile details you enter.',
      },
    ],
  },
  {
    heading: 'Resumes and documents',
    blocks: [
      {
        type: 'p',
        text: 'If you upload a PDF or text file, or paste resume text, that text is read in your browser and can be sent to the application’s analysis service only after you tick the consent box and choose Analyze. You review extracted skills before they are saved. The application does not publish your resume. Avoid this step if you do not want that text processed.',
      },
    ],
  },
  {
    heading: 'Bookings, notes, and feedback',
    blocks: [
      {
        type: 'ul',
        items: [
          'Interview bookings, including the interviewer, service, time, status, and the price calculated for that booking.',
          'Private notes you type during or after an interview. Only you can read your notes.',
          'Chat messages sent inside an interview, which the other participant can read.',
          'Interviewer feedback and your review of an interviewer, where those features are used.',
          'Optional comments about the RoundOne interview experience. You can skip that form.',
        ],
      },
    ],
  },
  {
    heading: 'Audio, video, and voice',
    blocks: [
      {
        type: 'p',
        text: 'Joining a live interview uses your camera and microphone so the other person can see and hear you. That live call is separate from recording. Recording does not start by itself. A participant must tick the recording consent box and choose Start recording. If that succeeds, the application attempts to store a private video file with that interview. Either participant can later save a copy to their own computer. Storage can fail, so this notice does not promise that a file exists for every call.',
      },
      {
        type: 'p',
        text: 'AI Practice is optional. If you start it, your microphone and spoken or written answers can be sent to the server so the practice interviewer can ask questions and return feedback. You can leave that feature unused.',
      },
    ],
  },
  {
    heading: 'Payments',
    blocks: [
      {
        type: 'p',
        text: 'A booking can store a session fee, a platform fee, a total, a currency, and a payment status. Checkout in this application is a stub: it does not charge a card. No live payment-provider account is connected here. If a real payment provider is added later, its records would be described in an updated notice.',
      },
    ],
  },
  {
    heading: 'Why data is used',
    blocks: [
      {
        type: 'ul',
        items: [
          'To create and protect your candidate account.',
          'To show interviewers, book a time, and run the interview you joined.',
          'To save notes, messages, feedback, and an optional recording when you use those controls.',
          'To calculate the price shown for a selected interviewer service.',
          'To provide optional AI practice, preparation, resume analysis, or matching assistance when you start those features.',
        ],
      },
    ],
  },
  {
    heading: 'AI processing',
    blocks: [
      {
        type: 'p',
        text: 'Optional AI features send the text or audio needed for that request through the application server to an AI provider. The server is configured for an OpenAI-compatible API. The default base address is the provider’s API host, and the operator can point it elsewhere. The application does not claim that the provider never stores prompts or outputs. Do not start resume analysis, AI Practice, AI Preparation, or other AI actions if you want to avoid that processing. Skill browsing and booking do not require those optional AI actions.',
      },
    ],
  },
  {
    heading: 'Service providers',
    blocks: [
      {
        type: 'p',
        text: 'The candidate application uses Supabase for accounts, database storage, and private file storage; LiveKit for the live interview room and, when someone starts it, recording; the configured AI API for optional AI features; and Google sign-in if you choose that option. This draft does not claim a security audit or compliance mark.',
      },
    ],
  },
  {
    heading: 'Cookies and similar storage',
    blocks: [
      {
        type: 'p',
        text: 'This application does not add an advertising or product-analytics tracker. The sign-in session and a few interface choices, such as skipping the optional experience form, are kept in browser storage. If you use Google sign-in, Google may set its own cookies under Google’s terms. No separate cookie banner is shipped because no extra analytics cookies were added for these pages.',
      },
    ],
  },
  {
    heading: 'Retention, deletion, and requests',
    blocks: [
      {
        type: 'p',
        text: 'Profile, skills, preferences, and practice data are removed when you delete your account from Profile. You must type DELETE to confirm. Deletion is refused while an interview is in progress. Future bookings that are still unpaid, requested, or confirmed, and that have not started, are cancelled. Your reviews are removed. Shared booking and payment rows can remain so the interviewer and the operator still have a transaction record, with your profile detached. This draft does not promise that every copy is erased immediately, and it does not set a retention period. A retention schedule needs company approval.',
      },
      {
        type: 'p',
        text: 'To ask about your personal data, use the personal-data section on the Contact Us page. A verified contact address is not configured in the application yet.',
      },
    ],
  },
]

export const termsSections: LegalSection[] = [
  {
    heading: 'Using an account',
    blocks: [
      {
        type: 'p',
        text: `These draft terms apply to the ${PRODUCT_NAME} candidate application operated by ${COMPANY_LEGAL_NAME}. They need company and legal review before launch. They do not set a court, a liability cap, or a service-level promise.`,
      },
      {
        type: 'p',
        text: 'You are responsible for the sign-in method you use and for activity on your account. Provide profile information that you believe is accurate, and update it when it changes. Do not share your account in a way that lets someone else impersonate you.',
      },
    ],
  },
  {
    heading: 'Acceptable use and interviews',
    blocks: [
      {
        type: 'ul',
        items: [
          'Use the service for your own interview preparation and booking.',
          'Do not harass the other person, attempt to break the service, or upload content you have no right to share.',
          'Do not start a recording unless you have read the on-screen notice and chosen to record. Recording is off until a participant starts it.',
          'The live room, timing, and interviewer availability can fail or change. A booking request is not a confirmed interview until the product shows it as confirmed.',
        ],
      },
    ],
  },
  {
    heading: 'AI output',
    blocks: [
      {
        type: 'p',
        text: 'Practice questions, scores, resume extracts, preparation ideas, and matching suggestions are aids. They can be wrong or incomplete. They are not a hiring decision, a guarantee of an interview outcome, or professional advice. You choose whether to start those optional features.',
      },
    ],
  },
  {
    heading: 'Intellectual property',
    blocks: [
      {
        type: 'p',
        text: 'The application, its branding, and its software belong to their owners. You keep your rights in the profile text, resume text, and notes you submit. You allow the service to host and process that material only so it can provide the features you use.',
      },
    ],
  },
  {
    heading: 'Suspension and ending access',
    blocks: [
      {
        type: 'p',
        text: 'The operator may suspend or close an account that breaks these terms or puts another person or the service at risk. You may delete your own candidate account from Profile, subject to the limits described in the Privacy Policy. Ending an account does not by itself delete every shared booking or payment record.',
      },
    ],
  },
  {
    heading: 'Liability',
    blocks: [
      {
        type: 'p',
        text: 'The service is provided in its current form, including unfinished payment and recording paths. To the extent the law allows, the operator is not promising uninterrupted access, a particular interviewer, or a particular result from AI output. Any limitation of liability, indemnity, or governing-law clause still needs company approval and is not stated here.',
      },
    ],
  },
]

export const refundSections: LegalSection[] = [
  {
    heading: 'What the product does today',
    blocks: [
      {
        type: 'p',
        text: 'Checkout does not charge a card. Pay & Confirm records a stub payment so the booking can move forward. The confirmation screen states that no card is charged.',
      },
      {
        type: 'ul',
        items: [
          'A new booking can be held for about 10 minutes while that stub payment step is open. After the hold ends, the slot is no longer reserved.',
          'The database can mark an unpaid, requested, or confirmed booking as cancelled, and can mark an unpaid payment row as cancelled.',
          'That cancellation path does not create a refund for a payment that has already been captured.',
          'The candidate website does not currently show a cancel or reschedule button. A reschedule function exists in the database for requested or confirmed bookings, but it is not offered on this site.',
          'If an interviewer declines a request, a notification can say that a refund will be processed later. No refund workflow is implemented.',
          'Deleting an account cancels future bookings that are unpaid, requested, or confirmed and have not started. It does not run a refund.',
        ],
      },
    ],
  },
  {
    heading: 'Pending company approval',
    blocks: [
      {
        type: 'note',
        text: 'Do not treat this page as a customer promise. The company still needs to approve whether candidates may cancel, whether a captured payment is refundable, any deadline, any fee, and what the decline message means once a real payment provider exists. No refund timeline is stated because none is implemented.',
      },
    ],
  },
]

export const pricingSections: LegalSection[] = [
  {
    heading: 'Prices are set per interviewer service',
    blocks: [
      {
        type: 'p',
        text: 'There is no single public price list in this application. Each bookable service stores its own session price in paise and a currency, usually INR. The booking screen shows that session price. At checkout the total is the session fee plus a platform fee.',
      },
      {
        type: 'p',
        text: 'The current code sets the platform fee to the greater of ₹49 and 5% of the session fee. That figure is what the software calculates. It is not a final commercial tariff until the company approves it.',
      },
    ],
  },
  {
    heading: 'Payment is not live',
    blocks: [
      {
        type: 'note',
        text: 'Card payment is not enabled. The Pay & Confirm step is a stub and does not charge a card. Do not read a price on an interviewer profile as an amount that will be collected today. When a payment provider is connected, this page and the checkout copy need to be updated together.',
      },
      {
        type: 'p',
        text: 'Questions about a price you already see on a booking belong with the Refund & Cancellation Policy. Refund eligibility is not established.',
      },
    ],
  },
]

export const contactSections: LegalSection[] = [
  {
    heading: 'Support',
    blocks: [
      {
        type: 'p',
        text: `${PRODUCT_NAME} is operated by ${COMPANY_LEGAL_NAME}. The product name appears in the application as ${PRODUCT_NAME}.`,
      },
      {
        type: 'note',
        text: 'Needs company approval: a support email, phone number, and postal address are not configured in this project. This page does not invent them. Do not send personal data until a verified address is published here.',
      },
    ],
  },
  {
    id: 'personal-data',
    heading: 'Personal data requests',
    blocks: [
      {
        type: 'p',
        text: 'You can delete your own candidate account from Profile. Type DELETE to confirm. That action is unavailable while an interview is in progress, and it does not erase every shared booking or payment record.',
      },
      {
        type: 'p',
        text: 'For access, correction, or another personal-data request, the company must publish a verified contact on this page first. Until then, there is no support address in the application to receive that request.',
      },
      {
        type: 'note',
        text: 'Needs company approval: the address, email, or form that should receive personal-data requests under the Digital Personal Data Protection Act, 2023.',
      },
    ],
  },
]
