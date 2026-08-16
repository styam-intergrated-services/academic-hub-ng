-- Drop the old trigger (if exists) and replace the handler with an AFTER trigger implementation.

-- 1) Drop existing BEFORE trigger (safe even if absent)
DROP TRIGGER IF EXISTS trg_result_published ON public.results;

-- 2) Replace/on-create the handler as an AFTER trigger function
CREATE OR REPLACE FUNCTION public.on_result_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semester UUID;
BEGIN
  -- only act when status changes to 'published'
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published') THEN
    -- persist published_at on the stored row (guarded)
    UPDATE public.results
      SET published_at = COALESCE(published_at, now())
    WHERE id = NEW.id AND (published_at IS NULL OR published_at = '');

    -- find semester for the offering
    SELECT semester_id INTO v_semester FROM public.course_offerings WHERE id = NEW.offering_id;

    -- recompute aggregates (these read from public.results and will now see the newly published row)
    PERFORM public.recompute_student_cgpa(NEW.student_id);
    PERFORM public.recompute_semester_gpa(NEW.student_id, v_semester);

    -- notify student (guard against duplicates if you want by making notifications unique)
    INSERT INTO public.notifications(user_id, title, body, category)
      VALUES (NEW.student_id, 'Result Published', 'A new course result has been published.', 'result');
  END IF;

  -- For AFTER triggers, return NULL (value is ignored)
  RETURN NULL;
END;
$$;

-- 3) Create AFTER trigger (only fires on status change)
CREATE TRIGGER trg_result_published
  AFTER UPDATE OF status ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.on_result_published();
