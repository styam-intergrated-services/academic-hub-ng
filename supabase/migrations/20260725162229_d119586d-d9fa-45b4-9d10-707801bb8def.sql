
-- 1. Applications: force reviewer_id null on applicant insert
DROP POLICY IF EXISTS "Applicants insert own application" ON public.applications;
CREATE POLICY "Applicants insert own application" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending'::application_status AND reviewer_id IS NULL);

-- 2. Fee structures: scope SELECT
DROP POLICY IF EXISTS "auth read fee_structures" ON public.fee_structures;
CREATE POLICY "fee_structures read scoped" ON public.fee_structures
  FOR SELECT TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','bursary','provost','dean','hod']::app_role[])
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.auth_user_id = auth.uid())
  );

-- 3. Exam schedules: scope SELECT
DROP POLICY IF EXISTS exam_schedules_read_all_auth ON public.exam_schedules;
CREATE POLICY exam_schedules_read_scoped ON public.exam_schedules
  FOR SELECT TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['registry','dean','hod','super_admin','ict_admin','provost']::app_role[])
    OR eo_covers_offering(auth.uid(), offering_id)
    OR EXISTS (SELECT 1 FROM public.course_lecturers cl WHERE cl.offering_id = exam_schedules.offering_id AND cl.lecturer_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.course_registrations cr
      JOIN public.students s ON s.id = cr.student_id
      WHERE cr.offering_id = exam_schedules.offering_id AND s.auth_user_id = auth.uid()
    )
  );

-- 4. Exam invigilators: scope SELECT (mirror schedules)
DROP POLICY IF EXISTS exam_invig_read_all_auth ON public.exam_invigilators;
CREATE POLICY exam_invig_read_scoped ON public.exam_invigilators
  FOR SELECT TO authenticated
  USING (
    staff_id = auth.uid()
    OR has_any_role(auth.uid(), ARRAY['registry','dean','hod','super_admin','ict_admin','provost']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.exam_schedules es
      WHERE es.id = exam_invigilators.schedule_id
        AND (
          eo_covers_offering(auth.uid(), es.offering_id)
          OR EXISTS (SELECT 1 FROM public.course_lecturers cl WHERE cl.offering_id = es.offering_id AND cl.lecturer_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.course_registrations cr
            JOIN public.students s ON s.id = cr.student_id
            WHERE cr.offering_id = es.offering_id AND s.auth_user_id = auth.uid()
          )
        )
    )
  );

-- 5. Revoke anon EXECUTE on SECURITY DEFINER helpers and trigger fn
REVOKE EXECUTE ON FUNCTION public.current_student_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.eo_covers_offering(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_result_published_after() FROM anon, PUBLIC;
