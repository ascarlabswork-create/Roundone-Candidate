export const ROOM_SIGNAL_TOPIC = 'roundone-room'

export type HandSignal = {
  v: 1
  type: 'hand'
  raised: boolean
}

export function encodeHandSignal(raised: boolean) {
  const payload: HandSignal = { v: 1, type: 'hand', raised }
  return new TextEncoder().encode(JSON.stringify(payload))
}

export function parseHandSignal(data: Uint8Array | undefined): boolean | null {
  if (!data || data.length === 0) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(data)) as Partial<HandSignal>
    if (parsed.v !== 1 || parsed.type !== 'hand' || typeof parsed.raised !== 'boolean') return null
    return parsed.raised
  } catch {
    return null
  }
}

export function participantLabel(identity: string, remoteDisplayName: string) {
  if (identity.startsWith('interviewer:')) return remoteDisplayName
  if (identity.startsWith('candidate:')) return 'Candidate'
  return remoteDisplayName
}
