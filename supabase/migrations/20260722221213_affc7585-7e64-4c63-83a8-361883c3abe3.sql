-- Remove ability for authenticated clients to insert audit logs directly.
-- Audit rows are now written only from server-side (SECURITY DEFINER / service role).
DROP POLICY IF EXISTS "Insert own audit" ON public.audit_logs;

-- Tighten Registry insert on applications: reviewer_id must be NULL at creation.
-- Reviewer attribution only happens on update where it must equal auth.uid().
DROP POLICY IF EXISTS "Registry insert applications" ON public.applications;
CREATE POLICY "Registry insert applications" ON public.applications
FOR INSERT TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'ict_admin'::app_role,'registry'::app_role])
  AND reviewer_id IS NULL
);