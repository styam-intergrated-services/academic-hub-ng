
-- Fix 1: Lecturers upsert results policy bug (cl.offering_id = cl.offering_id)
DROP POLICY IF EXISTS "Lecturers upsert results" ON public.results;
CREATE POLICY "Lecturers upsert results" ON public.results
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_lecturers cl
      WHERE cl.offering_id = results.offering_id
        AND cl.lecturer_id = auth.uid()
    )
    OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'ict_admin'::app_role,'registry'::app_role])
  );

-- Fix 2: Audit logs immutability — explicit deny UPDATE/DELETE
CREATE POLICY "Audit logs no update" ON public.audit_logs
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Audit logs no delete" ON public.audit_logs
  FOR DELETE TO authenticated USING (false);

-- Fix 3: Notifications — restrict inserts so users can only insert for themselves;
-- privileged staff roles may insert for any user (legitimate system notifications)
DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Staff insert notifications for any user" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'ict_admin'::app_role,'registry'::app_role,'bursary'::app_role,'dean'::app_role,'hod'::app_role])
  );

-- Fix 4: Revoke EXECUTE on SECURITY DEFINER functions from authenticated,
-- except role-check helpers required by RLS policies.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.compute_grade(numeric) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fill_result_grade() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.log_result_change() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_student_cgpa(uuid) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_semester_gpa(uuid, uuid) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.on_result_published() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.validate_registration() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, authenticated, anon;
-- has_role, has_any_role, current_user_roles must remain callable for RLS evaluation.
