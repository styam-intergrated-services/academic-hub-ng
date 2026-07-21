
-- 1) Pending role grants
CREATE TABLE IF NOT EXISTS public.pending_role_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email, role)
);
GRANT SELECT, INSERT, DELETE ON public.pending_role_grants TO authenticated;
GRANT ALL ON public.pending_role_grants TO service_role;
ALTER TABLE public.pending_role_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pending grants" ON public.pending_role_grants
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, pg.role FROM public.pending_role_grants pg
  WHERE lower(pg.email) = lower(NEW.email)
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.pending_role_grants WHERE lower(email) = lower(NEW.email);

  RETURN NEW;
END; $$;

-- Reserve or grant provost for ayubansar200@gmail.com
INSERT INTO public.pending_role_grants (email, role)
VALUES ('ayubansar200@gmail.com', 'provost')
ON CONFLICT (email, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'provost'::public.app_role
FROM public.profiles p
WHERE lower(p.email) = 'ayubansar200@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.pending_role_grants
WHERE lower(email) = 'ayubansar200@gmail.com'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.email)='ayubansar200@gmail.com');

-- 2) Enums
DO $$ BEGIN
  CREATE TYPE public.senate_status AS ENUM ('draft','pending_senate','published','archived','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.graduation_status AS ENUM ('draft','pending_senate','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.policy_status AS ENUM ('draft','pending_senate','active','archived','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.result_status_code AS ENUM ('OK','ABS','INC','WH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status public.senate_status NOT NULL DEFAULT 'draft',
  author_id UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  publish_at TIMESTAMPTZ,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read published announcements" ON public.announcements FOR SELECT TO authenticated
  USING (status = 'published' OR author_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost']::public.app_role[]));
CREATE POLICY "Staff create announcements" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost','dean']::public.app_role[]));
CREATE POLICY "Author or senate updates announcements" ON public.announcements FOR UPDATE TO authenticated
  USING (author_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','provost','registry']::public.app_role[]))
  WITH CHECK (true);
CREATE POLICY "Admins delete announcements" ON public.announcements FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]));
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Graduation lists
CREATE TABLE IF NOT EXISTS public.graduation_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status public.graduation_status NOT NULL DEFAULT 'draft',
  prepared_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.graduation_lists TO authenticated;
GRANT ALL ON public.graduation_lists TO service_role;
ALTER TABLE public.graduation_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Senate reads graduation lists" ON public.graduation_lists FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost','dean']::public.app_role[]));
CREATE POLICY "Registry creates graduation lists" ON public.graduation_lists FOR INSERT TO authenticated
  WITH CHECK (prepared_by = auth.uid()
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]));
CREATE POLICY "Senate updates graduation lists" ON public.graduation_lists FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost']::public.app_role[]))
  WITH CHECK (true);
CREATE POLICY "Admins delete graduation lists" ON public.graduation_lists FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]));
CREATE TRIGGER trg_graduation_lists_updated_at BEFORE UPDATE ON public.graduation_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.graduation_list_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.graduation_lists(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id),
  cgpa NUMERIC(4,2),
  classification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(list_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.graduation_list_entries TO authenticated;
GRANT ALL ON public.graduation_list_entries TO service_role;
ALTER TABLE public.graduation_list_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Senate reads graduation entries" ON public.graduation_list_entries FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost','dean']::public.app_role[]));
CREATE POLICY "Registry manages graduation entries" ON public.graduation_list_entries FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]));

-- 5) Policies
CREATE TABLE IF NOT EXISTS public.policy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  body_md TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  status public.policy_status NOT NULL DEFAULT 'draft',
  author_id UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_documents TO authenticated;
GRANT ALL ON public.policy_documents TO service_role;
ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read active or own policies" ON public.policy_documents FOR SELECT TO authenticated
  USING (status = 'active' OR author_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost']::public.app_role[]));
CREATE POLICY "Staff create policies" ON public.policy_documents FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost']::public.app_role[]));
CREATE POLICY "Author or senate updates policies" ON public.policy_documents FOR UPDATE TO authenticated
  USING (author_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','provost','registry']::public.app_role[]))
  WITH CHECK (true);
CREATE POLICY "Admins delete policies" ON public.policy_documents FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]));
CREATE TRIGGER trg_policy_documents_updated_at BEFORE UPDATE ON public.policy_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Academic calendar
CREATE TABLE IF NOT EXISTS public.academic_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  end_date DATE,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_calendar_events TO authenticated;
GRANT ALL ON public.academic_calendar_events TO service_role;
ALTER TABLE public.academic_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads calendar" ON public.academic_calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Registry manages calendar" ON public.academic_calendar_events FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]));
CREATE TRIGGER trg_academic_calendar_events_updated_at BEFORE UPDATE ON public.academic_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.academic_sessions
  ADD COLUMN IF NOT EXISTS calendar_status public.senate_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS calendar_approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS calendar_approved_at TIMESTAMPTZ;

-- 7) Results additions
ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS requires_senate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS correction_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS correction_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_code public.result_status_code NOT NULL DEFAULT 'OK';

CREATE OR REPLACE FUNCTION public.fill_result_grade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE g RECORD; total NUMERIC;
BEGIN
  IF NEW.status_code IS DISTINCT FROM 'OK' THEN
    NEW.grade := NEW.status_code::TEXT;
    NEW.grade_point := 0;
    RETURN NEW;
  END IF;
  total := COALESCE(NEW.ca_score,0) + COALESCE(NEW.exam_score,0);
  SELECT * INTO g FROM public.compute_grade(total);
  NEW.grade := g.grade;
  NEW.grade_point := g.grade_point;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.recompute_student_cgpa(_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_units INT; v_total_points NUMERIC; v_cgpa NUMERIC; v_standing public.academic_standing;
BEGIN
  SELECT COALESCE(SUM(c.credit_units),0),
         COALESCE(SUM(c.credit_units * r.grade_point),0)
    INTO v_total_units, v_total_points
  FROM public.results r
  JOIN public.course_offerings o ON o.id = r.offering_id
  JOIN public.courses c ON c.id = o.course_id
  WHERE r.student_id = _student_id AND r.status = 'published' AND r.status_code = 'OK';

  IF v_total_units = 0 THEN v_cgpa := 0; ELSE v_cgpa := ROUND(v_total_points / v_total_units, 2); END IF;

  v_standing := CASE
    WHEN v_cgpa >= 4.5 THEN 'excellent'::public.academic_standing
    WHEN v_cgpa >= 2.0 THEN 'good'::public.academic_standing
    WHEN v_cgpa >= 1.0 THEN 'probation'::public.academic_standing
    ELSE 'withdrawn'::public.academic_standing
  END;

  UPDATE public.students SET
    cgpa = v_cgpa, total_credit_units = v_total_units,
    total_grade_points = v_total_points, standing = v_standing
  WHERE id = _student_id;
END; $$;

CREATE OR REPLACE FUNCTION public.recompute_semester_gpa(_student_id uuid, _semester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_units INT; v_points NUMERIC; v_gpa NUMERIC; v_std public.academic_standing; v_cgpa NUMERIC;
BEGIN
  SELECT COALESCE(SUM(c.credit_units),0),
         COALESCE(SUM(c.credit_units * r.grade_point),0)
    INTO v_units, v_points
  FROM public.results r
  JOIN public.course_offerings o ON o.id = r.offering_id
  JOIN public.courses c ON c.id = o.course_id
  WHERE r.student_id = _student_id AND o.semester_id = _semester_id AND r.status = 'published' AND r.status_code = 'OK';

  IF v_units = 0 THEN v_gpa := 0; ELSE v_gpa := ROUND(v_points / v_units, 2); END IF;

  SELECT cgpa INTO v_cgpa FROM public.students WHERE id = _student_id;
  v_std := CASE WHEN v_gpa >= 4.5 THEN 'excellent' WHEN v_gpa >= 2.0 THEN 'good' WHEN v_gpa >= 1.0 THEN 'probation' ELSE 'withdrawn' END::public.academic_standing;

  INSERT INTO public.gpa_records(student_id, semester_id, gpa, cgpa, credit_units, grade_points, standing, computed_at)
  VALUES (_student_id, _semester_id, v_gpa, COALESCE(v_cgpa,0), v_units, v_points, v_std, now())
  ON CONFLICT (student_id, semester_id)
  DO UPDATE SET gpa=EXCLUDED.gpa, cgpa=EXCLUDED.cgpa, credit_units=EXCLUDED.credit_units,
                grade_points=EXCLUDED.grade_points, standing=EXCLUDED.standing, computed_at=now();
END; $$;

-- 8) Senate approval notifications
CREATE OR REPLACE FUNCTION public.notify_provosts_of_senate_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD; v_title TEXT; v_body TEXT;
BEGIN
  IF TG_TABLE_NAME = 'announcements' THEN v_title := 'Announcement pending senate approval'; v_body := NEW.title;
  ELSIF TG_TABLE_NAME = 'graduation_lists' THEN v_title := 'Graduation list pending senate approval'; v_body := NEW.title;
  ELSIF TG_TABLE_NAME = 'policy_documents' THEN v_title := 'Policy pending senate approval'; v_body := NEW.title;
  ELSE v_title := 'Item pending senate approval'; v_body := COALESCE(NEW.title, 'New item');
  END IF;

  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'provost'::public.app_role LOOP
    INSERT INTO public.notifications(user_id, title, body, category)
    VALUES (r.user_id, v_title, v_body, 'senate_approval');
  END LOOP;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_provosts_of_senate_item() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_announcements_senate_notify
  AFTER INSERT OR UPDATE OF status ON public.announcements
  FOR EACH ROW WHEN (NEW.status = 'pending_senate')
  EXECUTE FUNCTION public.notify_provosts_of_senate_item();

CREATE TRIGGER trg_graduation_lists_senate_notify
  AFTER INSERT OR UPDATE OF status ON public.graduation_lists
  FOR EACH ROW WHEN (NEW.status = 'pending_senate')
  EXECUTE FUNCTION public.notify_provosts_of_senate_item();

CREATE TRIGGER trg_policy_documents_senate_notify
  AFTER INSERT OR UPDATE OF status ON public.policy_documents
  FOR EACH ROW WHEN (NEW.status = 'pending_senate')
  EXECUTE FUNCTION public.notify_provosts_of_senate_item();

CREATE OR REPLACE FUNCTION public.notify_session_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    FOR r IN SELECT user_id FROM public.user_roles WHERE role IN ('provost','super_admin','ict_admin','registry') LOOP
      INSERT INTO public.notifications(user_id, title, body, category)
      VALUES (r.user_id, 'Academic session opened', 'Session ' || NEW.name || ' is now active.', 'session_lifecycle');
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_session_lifecycle() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_session_lifecycle ON public.academic_sessions;
CREATE TRIGGER trg_session_lifecycle AFTER UPDATE OF status ON public.academic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.notify_session_lifecycle();
