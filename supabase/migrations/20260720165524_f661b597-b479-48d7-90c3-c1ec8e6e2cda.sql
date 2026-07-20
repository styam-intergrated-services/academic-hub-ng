
-- Tighten applications RLS: registry/admin writes must attribute reviewer_id to themselves
DROP POLICY IF EXISTS "Registry manage applications" ON public.applications;

CREATE POLICY "Registry read applications" ON public.applications
FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'ict_admin'::app_role,'registry'::app_role]));

CREATE POLICY "Registry insert applications" ON public.applications
FOR INSERT TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'ict_admin'::app_role,'registry'::app_role])
  AND (reviewer_id IS NULL OR reviewer_id = auth.uid())
);

CREATE POLICY "Registry update applications" ON public.applications
FOR UPDATE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'ict_admin'::app_role,'registry'::app_role]))
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'ict_admin'::app_role,'registry'::app_role])
  AND (reviewer_id IS NULL OR reviewer_id = auth.uid())
);

CREATE POLICY "Registry delete applications" ON public.applications
FOR DELETE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'ict_admin'::app_role,'registry'::app_role]));

-- Remove staff-wide notification insert; only self-inserts allowed from clients.
-- Server-side (service role) writes bypass RLS for system notifications.
DROP POLICY IF EXISTS "Staff insert notifications for any user" ON public.notifications;

-- Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
-- Keep only the RLS helper trio (has_role, has_any_role, current_user_roles) executable
-- by authenticated — they are required by RLS policy expressions.
REVOKE EXECUTE ON FUNCTION public.matriculate_application(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_result_published() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_registration() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_result_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_student_cgpa(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_semester_gpa(uuid, uuid) FROM PUBLIC, anon, authenticated;
