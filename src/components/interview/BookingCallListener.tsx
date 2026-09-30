import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { confirmationCallTarget } from '../../interview/callModel.ts'
import { supabase } from '../../lib/supabase.ts'
import { useSession } from '../../state/session.tsx'
import { useToast } from '../../state/toast.tsx'

export function BookingCallListener() {
  const { account } = useSession()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const pathRef = useRef(location.pathname)
  const openedRef = useRef(new Set<string>())
  pathRef.current = location.pathname

  useEffect(() => {
    const candidateProfileId = account?.candidate.id
    if (!candidateProfileId) return

    const channel = supabase
      .channel(`bookings-candidate-${candidateProfileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `candidate_profile_id=eq.${candidateProfileId}`,
        },
        (payload) => {
          const next = payload.new as { id?: string; status?: string }
          const previous = payload.old as { status?: string }
          const bookingId = typeof next.id === 'string' ? next.id : ''
          const nextStatus = typeof next.status === 'string' ? next.status : ''
          const previousStatus = typeof previous.status === 'string' ? previous.status : ''
          if (!bookingId || openedRef.current.has(bookingId)) return
          const href = confirmationCallTarget({
            role: 'candidate',
            previousStatus,
            nextStatus,
            bookingId,
            currentPath: pathRef.current,
          })
          if (!href) return
          openedRef.current.add(bookingId)
          pushToast('Interview accepted. Connecting...')
          navigate(href)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [account?.candidate.id, navigate, pushToast])

  return null
}
