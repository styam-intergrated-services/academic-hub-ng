ALTER TABLE public.semesters DROP CONSTRAINT IF EXISTS semesters_session_id_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS semesters_session_type_no_contact_key
  ON public.semesters (session_id, type)
  WHERE contact_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS semesters_session_contact_key
  ON public.semesters (session_id, contact_number)
  WHERE contact_number IS NOT NULL;