-- Backfill recomputations for all students who have published results.
-- Run this once after deploying the trigger migration. Use a maintenance window for large datasets.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Recompute per-student overall CGPA
  FOR r IN
    SELECT DISTINCT student_id FROM public.results WHERE status = 'published'
  LOOP
    PERFORM public.recompute_student_cgpa(r.student_id);
  END LOOP;

  -- Recompute per-student per-semester GPA
  FOR r IN
    SELECT DISTINCT r.student_id AS student_id, o.semester_id AS semester_id
    FROM public.results r
    JOIN public.course_offerings o ON o.id = r.offering_id
    WHERE r.status = 'published'
  LOOP
    PERFORM public.recompute_semester_gpa(r.student_id, r.semester_id);
  END LOOP;
END $$;
