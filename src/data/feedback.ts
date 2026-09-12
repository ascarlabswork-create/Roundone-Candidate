import type { InterviewerFeedback, ProgressSnapshot } from '../types.ts'
import { currentCandidate } from './candidate.ts'

export const interviewerFeedback: InterviewerFeedback[] = [
  {
    id: 'fb-rahul',
    bookingId: 'bk-completed-rahul',
    interviewerId: 'rahul-sharma',
    candidateId: currentCandidate.id,
    scores: {
      technicalSkills: 82,
      problemSolving: 80,
      communication: 84,
      systemDesign: 79,
      coding: 76,
      behavioral: 74,
      overall: 80,
    },
    strengths: [
      'Strong high-level architecture for a Google-style design loop',
      'Clear API contracts and failure-mode thinking',
      'Calm when the requirements shifted mid-session',
    ],
    improvements: [
      'Quantify QPS and storage before drawing boxes',
      'Call consistency vs availability earlier',
      'Time-box deep dives so the design closes',
    ],
    detailedFeedback:
      'You are close to the SDE 2 system design bar. The skeleton was sound and you recovered well from follow-ups. Lock in capacity math and you will look consistently ready.',
    readiness: 'Almost Ready',
    internalNotes: 'INTERNAL — do not expose. Candidate over-indexed on Kafka. Coaching note for interviewer only.',
  },
  {
    id: 'fb-marcus',
    bookingId: 'bk-completed-marcus',
    interviewerId: 'marcus-chen',
    candidateId: currentCandidate.id,
    scores: {
      technicalSkills: 78,
      problemSolving: 74,
      communication: 81,
      systemDesign: 72,
      coding: 75,
      behavioral: 70,
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
    detailedFeedback:
      'You are close to SDE 2 system design bar. The skeleton of the design was sound, but estimates and consistency choices arrived late. Another focused system design mock should lock this in.',
    readiness: 'Almost Ready',
    internalNotes: 'INTERNAL — bar-raiser would still probe LP ownership. Not for the candidate.',
  },
  {
    id: 'fb-david',
    bookingId: 'bk-completed-david',
    interviewerId: 'david-kim',
    candidateId: currentCandidate.id,
    scores: {
      technicalSkills: 80,
      problemSolving: 77,
      communication: 76,
      systemDesign: 64,
      coding: 82,
      behavioral: 68,
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
    detailedFeedback:
      'Coding is at the SDE 2 bar. System design is the gap. Keep coding sharp, but schedule a dedicated design interview next.',
    readiness: 'Almost Ready',
  },
  {
    id: 'fb-ananya',
    bookingId: 'bk-completed-ananya',
    interviewerId: 'ananya-rao',
    candidateId: currentCandidate.id,
    scores: {
      technicalSkills: 70,
      problemSolving: 72,
      communication: 68,
      systemDesign: 66,
      coding: 64,
      behavioral: 71,
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
    detailedFeedback:
      'Behavioral answers have good raw material but run long. Practice a 90-second version of each story before the next loop.',
    readiness: 'Needs More Practice',
  },
  {
    id: 'fb-other-candidate',
    bookingId: 'bk-other-secret',
    interviewerId: 'rahul-sharma',
    candidateId: 'cand-other',
    scores: {
      technicalSkills: 91,
      problemSolving: 90,
      communication: 88,
      systemDesign: 92,
      coding: 89,
      behavioral: 87,
      overall: 90,
    },
    strengths: ['Must never leak to Aditi'],
    improvements: ['Must never leak to Aditi'],
    detailedFeedback: 'Private feedback for another candidate. Candidate clients must not receive this record.',
    readiness: 'Ready',
    internalNotes: 'INTERNAL — other candidate only.',
  },
]

export const feedbackReports = interviewerFeedback

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
