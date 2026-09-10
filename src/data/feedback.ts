import type { FeedbackReport, ProgressSnapshot } from '../types.ts'

export const feedbackReports: FeedbackReport[] = [
  {
    id: 'fb-marcus',
    bookingId: 'bk-completed-marcus',
    interviewerId: 'marcus-chen',
    scores: {
      technicalSkills: 78,
      problemSolving: 74,
      communication: 81,
      systemDesign: 72,
      overall: 76,
    },
    strengths: [
      'Clear problem framing and API-first thinking',
      'Good instinct for partitioning and failure modes',
      'Calm under follow-up pressure',
    ],
    improvements: [
      'Quantify capacity before jumping to architecture',
      'Call out consistency trade-offs earlier',
      'Tie the final design back to the original constraints',
    ],
    overallFeedback:
      'You are close to SDE 2 system design bar. The skeleton of the design was sound, but estimates and consistency choices arrived late. Another focused system design mock should lock this in.',
    readiness: 'Almost Ready',
  },
  {
    id: 'fb-david',
    bookingId: 'bk-completed-david',
    interviewerId: 'david-kim',
    scores: {
      technicalSkills: 80,
      problemSolving: 77,
      communication: 76,
      systemDesign: 64,
      overall: 74,
    },
    strengths: [
      'Solid DSA patterns and complexity analysis',
      'Tests a few edge cases without prompting',
      'Readable, structured code',
    ],
    improvements: [
      'Start with brute force out loud, then optimize',
      'Watch off-by-one errors on sliding window',
      'System design still needs more practice at SDE 2 depth',
    ],
    overallFeedback:
      'Coding is at the SDE 2 bar. System design is the gap. Keep coding sharp, but schedule a dedicated design interview next.',
    readiness: 'Almost Ready',
  },
  {
    id: 'fb-ananya',
    bookingId: 'bk-completed-ananya',
    interviewerId: 'ananya-rao',
    scores: {
      technicalSkills: 70,
      problemSolving: 72,
      communication: 68,
      systemDesign: 66,
      overall: 69,
    },
    strengths: [
      'Genuine examples with real stakes',
      'Takes ownership instead of blaming teams',
    ],
    improvements: [
      'Tighten stories with Situation → Action → Result',
      'Quantify impact (latency, revenue, headcount)',
      'Show disagreement without sounding defensive',
    ],
    overallFeedback:
      'Behavioral answers have good raw material but run long. Practice a 90-second version of each story before the next loop.',
    readiness: 'Needs More Practice',
  },
]

export const progressSnapshot: ProgressSnapshot = {
  overall: 78,
  history: [62, 69, 74, 78],
  metrics: {
    coding: 80,
    systemDesign: 72,
    behavioral: 68,
    communication: 76,
    problemSolving: 77,
  },
  recommendation: {
    title: 'Practice another system design interview',
    body: 'Your system design score is improving. Practice another system design interview to convert “almost ready” into a consistent pass.',
    interviewType: 'System Design',
  },
}
