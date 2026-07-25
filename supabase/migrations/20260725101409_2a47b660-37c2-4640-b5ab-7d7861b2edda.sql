
-- Add examination_officer to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'examination_officer';

-- exam_scope_type enum
DO $$ BEGIN
  CREATE TYPE public.exam_scope_type AS ENUM ('programme','department','faculty');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============= examination_officers =============
CREATE TABLE IF NOT EXISTS public.examination_officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type public.exam_scope_type NOT NULL,
  scope_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope_type, scope_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.examination_officers TO authenticated;
GRANT ALL ON public.examination_officers TO service_role;
ALTER TABLE public.examination_officers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eo_self_read" ON public.examination_officers
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['registry','provost','super_admin','ict_admin']::app_role[])
  );

CREATE POLICY "eo_staff_manage" ON public.examination_officers
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['registry','provost','super_admin','ict_admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['registry','provost','super_admin','ict_admin']::app_role[]));

-- ============= exam_schedules =============
CREATE TABLE IF NOT EXISTS public.exam_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_schedules TO authenticated;
GRANT ALL ON public.exam_schedules TO service_role;
ALTER TABLE public.exam_schedules ENABLE ROW LEVEL SECURITY;

-- Helper: does the current user's EO scope cover a given offering?
CREATE OR REPLACE FUNCTION public.eo_covers_offering(_user_id uuid, _offering_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.examination_officers eo
    JOIN public.course_offerings o ON o.id = _offering_id
    JOIN public.courses c ON c.id = o.course_id
    LEFT JOIN public.departments d ON d.id = c.department_id
    WHERE eo.user_id = _user_id
      AND (
        (eo.scope_type = 'department' AND eo.scope_id = c.department_id)
        OR (eo.scope_type = 'faculty' AND eo.scope_id = d.faculty_id)
        OR (eo.scope_type = 'programme' AND EXISTS (
              SELECT 1 FROM public.programmes p
              WHERE p.id = eo.scope_id AND p.department_id = c.department_id
        ))
      )
  )
$$;
REVOKE ALL ON FUNCTION public.eo_covers_offering(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eo_covers_offering(uuid, uuid) TO authenticated;

-- Everyone signed-in can see exam schedules (students need to see their exams too).
CREATE POLICY "exam_schedules_read_all_auth" ON public.exam_schedules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "exam_schedules_staff_write" ON public.exam_schedules
  FOR ALL TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::app_role[])
    OR public.eo_covers_offering(auth.uid(), offering_id)
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::app_role[])
    OR public.eo_covers_offering(auth.uid(), offering_id)
  );

CREATE TRIGGER exam_schedules_updated_at
BEFORE UPDATE ON public.exam_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= exam_invigilators =============
CREATE TABLE IF NOT EXISTS public.exam_invigilators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.exam_schedules(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, staff_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_invigilators TO authenticated;
GRANT ALL ON public.exam_invigilators TO service_role;
ALTER TABLE public.exam_invigilators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_invig_read_all_auth" ON public.exam_invigilators
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "exam_invig_staff_write" ON public.exam_invigilators
  FOR ALL TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.exam_schedules es
      WHERE es.id = schedule_id
        AND public.eo_covers_offering(auth.uid(), es.offering_id)
    )
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['registry','dean','super_admin','ict_admin']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.exam_schedules es
      WHERE es.id = schedule_id
        AND public.eo_covers_offering(auth.uid(), es.offering_id)
    )
  );
