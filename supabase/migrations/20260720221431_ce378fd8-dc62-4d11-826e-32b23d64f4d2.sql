
-- Transcripts issued audit
CREATE TABLE public.transcripts_issued (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  serial TEXT NOT NULL UNIQUE,
  issued_by UUID NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT ON public.transcripts_issued TO authenticated;
GRANT ALL ON public.transcripts_issued TO service_role;

ALTER TABLE public.transcripts_issued ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own transcripts"
  ON public.transcripts_issued FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['registry','super_admin','ict_admin','dean']::app_role[]));

CREATE POLICY "Registry issues transcripts"
  ON public.transcripts_issued FOR INSERT
  TO authenticated
  WITH CHECK (
    issued_by = auth.uid()
    AND public.has_any_role(auth.uid(), ARRAY['registry','super_admin','ict_admin']::app_role[])
  );

-- Serial generator: AKCOE/TR/YYYY/NNNN (per year sequence)
CREATE OR REPLACE FUNCTION public.next_transcript_serial(_year INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_seq INT; v_prefix TEXT;
BEGIN
  v_prefix := 'AKCOE/TR/' || _year || '/';
  SELECT COALESCE(MAX(NULLIF(regexp_replace(serial, '^AKCOE/TR/\d+/', ''), '')::INT), 0) + 1
    INTO v_seq
  FROM public.transcripts_issued
  WHERE serial LIKE v_prefix || '%';
  RETURN v_prefix || LPAD(v_seq::TEXT, 4, '0');
END; $$;

REVOKE EXECUTE ON FUNCTION public.next_transcript_serial(INT) FROM PUBLIC, anon, authenticated;
