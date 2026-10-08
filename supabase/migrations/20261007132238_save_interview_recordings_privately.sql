-- Finished interview recordings live in the private interview-recordings bucket.
-- Only a participant of that session can upload or read the object. There is no public URL.

ALTER TABLE public.interview_recordings
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE public.interview_recordings
  DROP CONSTRAINT IF EXISTS interview_recordings_storage_path;

ALTER TABLE public.interview_recordings
  ADD CONSTRAINT interview_recordings_storage_path CHECK (
    storage_path IS NULL
    OR storage_path LIKE 'interviews/' || interview_session_id::text || '/%.mp4'
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('interview-recordings', 'interview-recordings', false, 1073741824)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS interview_recordings_select_participant ON storage.objects;
DROP POLICY IF EXISTS interview_recordings_insert_participant ON storage.objects;
DROP POLICY IF EXISTS interview_recordings_update_participant ON storage.objects;

CREATE POLICY interview_recordings_select_participant
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'interview-recordings'
    AND (storage.foldername(name))[1] = 'interviews'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    AND private.interview_participant_role(((storage.foldername(name))[2])::uuid) IS NOT NULL
  );

CREATE POLICY interview_recordings_insert_participant
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'interview-recordings'
    AND (storage.foldername(name))[1] = 'interviews'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    AND private.interview_participant_role(((storage.foldername(name))[2])::uuid) IS NOT NULL
  );

CREATE POLICY interview_recordings_update_participant
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'interview-recordings'
    AND (storage.foldername(name))[1] = 'interviews'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    AND private.interview_participant_role(((storage.foldername(name))[2])::uuid) IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'interview-recordings'
    AND (storage.foldername(name))[1] = 'interviews'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    AND private.interview_participant_role(((storage.foldername(name))[2])::uuid) IS NOT NULL
  );
