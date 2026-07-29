-- 1) exam_schedules / exam_invigilators: explicit per-command write policies
DROP POLICY IF EXISTS exam_schedules_staff_write ON public.exam_schedules;

CREATE POLICY exam_schedules_staff_insert ON public.exam_schedules
FOR INSERT TO authenticated
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::public.app_role[])
  OR public.eo_covers_offering(auth.uid(), offering_id)
);

CREATE POLICY exam_schedules_staff_update ON public.exam_schedules
FOR UPDATE TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::public.app_role[])
  OR public.eo_covers_offering(auth.uid(), offering_id)
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::public.app_role[])
  OR public.eo_covers_offering(auth.uid(), offering_id)
);

CREATE POLICY exam_schedules_staff_delete ON public.exam_schedules
FOR DELETE TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::public.app_role[])
  OR public.eo_covers_offering(auth.uid(), offering_id)
);

DROP POLICY IF EXISTS exam_invig_staff_write ON public.exam_invigilators;

CREATE POLICY exam_invig_staff_insert ON public.exam_invigilators
FOR INSERT TO authenticated
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::public.app_role[])
  OR EXISTS (SELECT 1 FROM public.exam_schedules es
             WHERE es.id = exam_invigilators.schedule_id
               AND public.eo_covers_offering(auth.uid(), es.offering_id))
);

CREATE POLICY exam_invig_staff_update ON public.exam_invigilators
FOR UPDATE TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::public.app_role[])
  OR EXISTS (SELECT 1 FROM public.exam_schedules es
             WHERE es.id = exam_invigilators.schedule_id
               AND public.eo_covers_offering(auth.uid(), es.offering_id))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::public.app_role[])
  OR EXISTS (SELECT 1 FROM public.exam_schedules es
             WHERE es.id = exam_invigilators.schedule_id
               AND public.eo_covers_offering(auth.uid(), es.offering_id))
);

CREATE POLICY exam_invig_staff_delete ON public.exam_invigilators
FOR DELETE TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::public.app_role[])
  OR EXISTS (SELECT 1 FROM public.exam_schedules es
             WHERE es.id = exam_invigilators.schedule_id
               AND public.eo_covers_offering(auth.uid(), es.offering_id))
);

-- 2) password_reset_requests: explicit staff-only resolution, no client insert/delete
REVOKE INSERT, DELETE ON public.password_reset_requests FROM authenticated, anon;
GRANT SELECT, UPDATE ON public.password_reset_requests TO authenticated;
GRANT ALL ON public.password_reset_requests TO service_role;

DROP POLICY IF EXISTS "Staff can resolve reset requests" ON public.password_reset_requests;
CREATE POLICY "Staff can resolve reset requests" ON public.password_reset_requests
FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]));

-- 3) pending_role_grants: only apply a grant to a verified email address
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  -- Only honour a pending role grant when the address has actually been verified.
  IF NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT NEW.id, pg.role FROM public.pending_role_grants pg
    WHERE lower(pg.email) = lower(NEW.email)
    ON CONFLICT (user_id, role) DO NOTHING;

    DELETE FROM public.pending_role_grants WHERE lower(email) = lower(NEW.email);
  END IF;

  RETURN NEW;
END; $function$;

-- Lets an account claim its pending grants once its email is verified.
CREATE OR REPLACE FUNCTION public.claim_pending_role_grants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_confirmed timestamptz;
  v_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;

  SELECT u.email, u.email_confirmed_at INTO v_email, v_confirmed
  FROM auth.users u WHERE u.id = auth.uid();

  IF v_email IS NULL OR v_confirmed IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.user_roles (user_id, role)
  SELECT auth.uid(), pg.role FROM public.pending_role_grants pg
  WHERE lower(pg.email) = lower(v_email)
  ON CONFLICT (user_id, role) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM public.pending_role_grants WHERE lower(email) = lower(v_email);
  RETURN v_count;
END; $function$;

REVOKE ALL ON FUNCTION public.claim_pending_role_grants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pending_role_grants() TO authenticated;