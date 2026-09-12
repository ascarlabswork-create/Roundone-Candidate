import { supabase } from '../lib/supabase.ts'
import { isUuid } from '../lib/uuid.ts'
import { findSlot, parseBookableSlotRows, type UtcBookableSlot } from './bookableSlots.ts'

export type { BookableSlotsQuery, DisplayBookableDay, UtcBookableSlot } from './bookableSlots.ts'
export {
  BOOKABLE_WINDOW_DAYS,
  civilDateForSlot,
  findSlot,
  getBookableWindow,
  groupSlotsByDisplayDate,
  sameUtcSlot,
} from './bookableSlots.ts'

const AVAILABILITY_ERROR = 'Unable to load availability.'

export type GetBookableSlotsInput = {
  interviewerProfileId: string
  serviceId: string
  from: Date
  to: Date
}

function failAvailability(error: { message: string } | null): void {
  if (error) throw new Error(AVAILABILITY_ERROR)
}

export async function getBookableSlots(input: GetBookableSlotsInput): Promise<UtcBookableSlot[]> {
  if (!isUuid(input.interviewerProfileId) || !isUuid(input.serviceId)) {
    return []
  }
  if (!(input.from instanceof Date) || Number.isNaN(input.from.getTime())) {
    throw new Error(AVAILABILITY_ERROR)
  }
  if (!(input.to instanceof Date) || Number.isNaN(input.to.getTime()) || input.to <= input.from) {
    return []
  }

  const { data, error } = await supabase.rpc('list_bookable_slots', {
    p_interviewer_profile_id: input.interviewerProfileId,
    p_service_id: input.serviceId,
    p_from: input.from.toISOString(),
    p_to: input.to.toISOString(),
  })

  failAvailability(error)
  return parseBookableSlotRows(data)
}

export async function isSlotStillBookable(input: {
  interviewerProfileId: string
  serviceId: string
  slot: UtcBookableSlot
}): Promise<boolean> {
  const start = new Date(input.slot.startsAtUtc)
  const end = new Date(input.slot.endsAtUtc)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false

  const slots = await getBookableSlots({
    interviewerProfileId: input.interviewerProfileId,
    serviceId: input.serviceId,
    from: start,
    to: end,
  })

  return Boolean(findSlot(slots, input.slot))
}
