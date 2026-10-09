import { encodeHandSignal, parseHandSignal, participantLabel } from './roomSignaling.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

expect(parseHandSignal(encodeHandSignal(true)) === true, 'raised hand encodes and decodes')
expect(parseHandSignal(encodeHandSignal(false)) === false, 'lowered hand encodes and decodes')
expect(parseHandSignal(new TextEncoder().encode('{"v":1,"type":"chat"}')) === null, 'unknown payloads are ignored')
expect(participantLabel('interviewer:abc', 'Alex') === 'Alex', 'interviewer label uses display name')
expect(participantLabel('candidate:abc', 'Alex') === 'Candidate', 'candidate label is generic')

console.log('roomSignaling.check passed')
