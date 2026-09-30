import { microphoneFailureMessage, microphoneStatusLabel } from './microphoneAccess.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const denied = microphoneFailureMessage(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
expect(denied.includes('Microphone access is required'), 'A denied microphone explains that access is required')
expect(microphoneFailureMessage(Object.assign(new Error('missing'), { name: 'NotFoundError' })).includes('No microphone'), 'A missing device is not described as a permission block')
expect(microphoneStatusLabel('error', false) !== 'Active (Listening for answer)', 'A blocked microphone is not shown as listening')
expect(microphoneStatusLabel('listening', false) === 'Active (Listening for answer)', 'A live microphone is shown as listening')
expect(microphoneStatusLabel('listening', true) === 'Muted (Audio paused)', 'A muted microphone is shown as muted')

console.log('microphone access checks passed')
