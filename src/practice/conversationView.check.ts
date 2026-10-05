import { practiceConversationLines } from './conversationView.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const first = { id: 'q1', question: 'How would you design a cache?' }
const second = { id: 'q2', question: 'What happens on a cache miss?' }

const lines = practiceConversationLines(
  [{ question: first, answer: 'I would use an LRU cache in front of the database.' }],
  second,
  'I would check the origin',
)

expect(lines.length === 4, 'History plus the live question and draft')
expect(lines[0]?.role === 'interviewer' && lines[0].text === first.question, 'Interviewer speaks first')
expect(lines[1]?.role === 'candidate' && !lines[1].draft, 'The finished answer is the candidate reply')
expect(lines[2]?.id === 'q-q2', 'The current question continues the same thread')
expect(lines[3]?.draft === true && lines[3].role === 'candidate', 'The live transcript is a draft reply')

const quiet = practiceConversationLines([], second, '   ')
expect(quiet.length === 1 && quiet[0]?.role === 'interviewer', 'A blank draft is not a message')

const repeated = practiceConversationLines([{ question: second, answer: 'Load from the database.' }], second, '')
expect(repeated.filter((line) => line.id === 'q-q2').length === 1, 'A finished question is not spoken twice')

console.log('practice conversation checks passed')
