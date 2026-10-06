-- Interview room chat, private notes, recording state, and optional app feedback.
-- Timing, LiveKit tokens, reviews, and interviewer feedback are unchanged.
-- now() and auth.uid() are server-side. A session id from the browser is not enough.

CREATE OR REPLACE FUNCTION private.interview_participant_role(p_session_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
  SELECT CASE
    WHEN private.owns_candidate_profile(bookings.candidate_profile_id) THEN 'candidate'
    WHEN private.owns_interviewer_profile(bookings.interviewer_profile_id) THEN 'interviewer'
    ELSE NULL
  END
  FROM public.interview_sessions AS sessions
  JOIN public.bookings AS bookings ON bookings.id = sessions.booking_id
  WHERE sessions.id = p_session_id;
$$;

REVOKE ALL ON FUNCTION private.interview_participant_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.interview_participant_role(uuid) TO authenticated, postgres, service_role;

CREATE TABLE public.interview_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_session_id uuid NOT NULL REFERENCES public.interview_sessions (id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_messages_length CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000)
);

CREATE INDEX interview_messages_session_created_idx
  ON public.interview_messages (interview_session_id, created_at);

CREATE TABLE public.interview_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_session_id uuid NOT NULL REFERENCES public.interview_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_notes_owner UNIQUE (interview_session_id, user_id),
  CONSTRAINT interview_notes_length CHECK (char_length(notes) <= 20000)
);

CREATE TABLE public.interview_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_session_id uuid NOT NULL UNIQUE REFERENCES public.interview_sessions (id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  status text NOT NULL,
  egress_id text,
  started_at timestamptz,
  stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_recordings_status CHECK (status IN ('recording', 'stopped', 'failed'))
);

CREATE TABLE public.interview_app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_session_id uuid NOT NULL REFERENCES public.interview_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  participant_role text NOT NULL,
  rating smallint,
  feedback text NOT NULL DEFAULT '',
  suggestions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_app_feedback_owner UNIQUE (interview_session_id, user_id),
  CONSTRAINT interview_app_feedback_role CHECK (participant_role IN ('candidate', 'interviewer')),
  CONSTRAINT interview_app_feedback_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  CONSTRAINT interview_app_feedback_length CHECK (
    char_length(feedback) <= 4000 AND char_length(suggestions) <= 4000
  ),
  CONSTRAINT interview_app_feedback_content CHECK (
    rating IS NOT NULL
    OR char_length(btrim(feedback)) > 0
    OR char_length(btrim(suggestions)) > 0
  )
);

CREATE TRIGGER interview_notes_updated_at
  BEFORE UPDATE ON public.interview_notes
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER interview_recordings_updated_at
  BEFORE UPDATE ON public.interview_recordings
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER interview_app_feedback_updated_at
  BEFORE UPDATE ON public.interview_app_feedback
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.interview_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_app_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY interview_messages_select_participant
  ON public.interview_messages
  FOR SELECT
  TO authenticated
  USING (private.interview_participant_role(interview_session_id) IS NOT NULL);

CREATE POLICY interview_messages_insert_self
  ON public.interview_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND private.interview_participant_role(interview_session_id) IS NOT NULL
  );

CREATE POLICY interview_notes_select_owner
  ON public.interview_notes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND private.interview_participant_role(interview_session_id) IS NOT NULL
  );

CREATE POLICY interview_notes_insert_owner
  ON public.interview_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND private.interview_participant_role(interview_session_id) IS NOT NULL
  );

CREATE POLICY interview_notes_update_owner
  ON public.interview_notes
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND private.interview_participant_role(interview_session_id) IS NOT NULL
  )
  WITH CHECK (
    user_id = auth.uid()
    AND private.interview_participant_role(interview_session_id) IS NOT NULL
  );

CREATE POLICY interview_recordings_select_participant
  ON public.interview_recordings
  FOR SELECT
  TO authenticated
  USING (private.interview_participant_role(interview_session_id) IS NOT NULL);

CREATE POLICY interview_app_feedback_select_owner
  ON public.interview_app_feedback
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND private.interview_participant_role(interview_session_id) IS NOT NULL
  );

CREATE POLICY interview_app_feedback_insert_owner
  ON public.interview_app_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND participant_role = private.interview_participant_role(interview_session_id)
  );

CREATE POLICY interview_app_feedback_update_owner
  ON public.interview_app_feedback
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND private.interview_participant_role(interview_session_id) IS NOT NULL
  )
  WITH CHECK (
    user_id = auth.uid()
    AND participant_role = private.interview_participant_role(interview_session_id)
  );

REVOKE ALL ON TABLE public.interview_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.interview_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.interview_recordings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.interview_app_feedback FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.interview_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.interview_notes TO authenticated;
GRANT SELECT ON TABLE public.interview_recordings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.interview_app_feedback TO authenticated;

ALTER TABLE public.interview_messages REPLICA IDENTITY FULL;
ALTER TABLE public.interview_recordings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'interview_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'interview_recordings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_recordings;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assert_interview_recording_access(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_role text;
  v_session public.interview_sessions%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_role := private.interview_participant_role(p_session_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.interview_sessions AS sessions WHERE sessions.id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_booking FROM public.bookings AS bookings WHERE bookings.id = v_session.booking_id;
  IF v_booking.status NOT IN ('confirmed'::public.booking_status, 'in_progress'::public.booking_status) THEN
    RAISE EXCEPTION 'booking_not_confirmed' USING ERRCODE = '42501';
  END IF;
  IF v_session.ended_at IS NOT NULL OR now() >= v_booking.ends_at THEN
    RAISE EXCEPTION 'session_expired' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'room_name', private.interview_room_name(v_session.id),
    'role', v_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assert_interview_recording_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_interview_recording_access(uuid) TO authenticated, postgres, service_role;
