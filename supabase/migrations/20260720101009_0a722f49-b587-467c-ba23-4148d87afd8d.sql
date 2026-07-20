
-- ============ ADMISSIONS ============

CREATE TYPE public.application_status AS ENUM ('pending','under_review','approved','rejected','matriculated');

CREATE TABLE public.applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male','female')),
  state_of_origin TEXT,
  lga TEXT,
  address TEXT,
  previous_school TEXT,
  qualification TEXT,
  subjects_grades JSONB,
  programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE RESTRICT,
  entry_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  status public.application_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  matric_number TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  matriculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants read own application" ON public.applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::app_role[]));

CREATE POLICY "Applicants insert own application" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Applicants update own pending application" ON public.applications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('pending','under_review'))
  WITH CHECK (user_id = auth.uid() AND status IN ('pending','under_review'));

CREATE POLICY "Registry manage applications" ON public.applications
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::app_role[]));

CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.matriculate_application(_application_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.applications%ROWTYPE;
  v_dept UUID;
  v_level UUID;
  v_year INT;
  v_seq INT;
  v_matric TEXT;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized to matriculate applications';
  END IF;

  SELECT * INTO v_app FROM public.applications WHERE id = _application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.status = 'matriculated' THEN RETURN v_app.matric_number; END IF;

  SELECT department_id INTO v_dept FROM public.programmes WHERE id = v_app.programme_id;
  SELECT id INTO v_level FROM public.levels WHERE code = 'NCE1';
  IF v_level IS NULL THEN RAISE EXCEPTION 'NCE1 level not seeded'; END IF;

  v_year := COALESCE(EXTRACT(YEAR FROM COALESCE((SELECT start_date FROM public.academic_sessions WHERE id = v_app.entry_session_id), CURRENT_DATE))::INT, EXTRACT(YEAR FROM CURRENT_DATE)::INT);

  SELECT COALESCE(MAX(NULLIF(regexp_replace(matric_number, '^AKCOE/\d+/', ''), '')::INT), 0) + 1
    INTO v_seq
  FROM public.students
  WHERE matric_number LIKE 'AKCOE/' || v_year || '/%';

  v_matric := 'AKCOE/' || v_year || '/' || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO public.profiles (id, email, full_name, phone, date_of_birth, gender, state_of_origin, lga, address)
  VALUES (v_app.user_id, v_app.email, v_app.full_name, v_app.phone, v_app.date_of_birth, v_app.gender, v_app.state_of_origin, v_app.lga, v_app.address)
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    date_of_birth = COALESCE(public.profiles.date_of_birth, EXCLUDED.date_of_birth),
    gender = COALESCE(public.profiles.gender, EXCLUDED.gender),
    state_of_origin = COALESCE(public.profiles.state_of_origin, EXCLUDED.state_of_origin),
    lga = COALESCE(public.profiles.lga, EXCLUDED.lga),
    address = COALESCE(public.profiles.address, EXCLUDED.address);

  INSERT INTO public.students (id, matric_number, programme_id, department_id, current_level_id, entry_session_id, entry_year)
  VALUES (v_app.user_id, v_matric, v_app.programme_id, v_dept, v_level, v_app.entry_session_id, v_year)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_app.user_id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.applications
    SET status = 'matriculated', matric_number = v_matric, matriculated_at = now(),
        reviewer_id = auth.uid(), reviewed_at = COALESCE(reviewed_at, now())
    WHERE id = _application_id;

  INSERT INTO public.notifications(user_id, title, body, category)
  VALUES (v_app.user_id, 'You have been matriculated', 'Welcome to AKCOE. Your matric number is ' || v_matric || '.', 'admission');

  RETURN v_matric;
END;
$$;

REVOKE ALL ON FUNCTION public.matriculate_application(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matriculate_application(UUID) TO authenticated;

-- ============ COURSE CATALOGUE SEED ============

DO $seed$
DECLARE
  L1 UUID; L2 UUID; L3 UUID;
  D_GSE UUID; D_EDF UUID; D_PSY UUID; D_CUR UUID;
BEGIN
  SELECT id INTO L1 FROM public.levels WHERE code='NCE1';
  SELECT id INTO L2 FROM public.levels WHERE code='NCE2';
  SELECT id INTO L3 FROM public.levels WHERE code='NCE3';
  SELECT id INTO D_GSE FROM public.departments WHERE code='GSE';
  SELECT id INTO D_EDF FROM public.departments WHERE code='EDF';
  SELECT id INTO D_PSY FROM public.departments WHERE code='PSY';
  SELECT id INTO D_CUR FROM public.departments WHERE code='CUR';

  INSERT INTO public.courses (department_id, code, title, credit_units, level_id, semester_type) VALUES
    (D_GSE,'GSE111','Use of English I',2,L1,'first'),
    (D_GSE,'GSE112','Communication in Arabic / French I',2,L1,'first'),
    (D_GSE,'GSE113','Nigerian Peoples and Culture',2,L1,'first'),
    (D_GSE,'GSE121','Use of English II',2,L1,'second'),
    (D_GSE,'GSE122','General Mathematics',2,L1,'second'),
    (D_GSE,'GSE123','Social Studies',2,L1,'second'),
    (D_GSE,'GSE211','Communication in English III',2,L2,'first'),
    (D_GSE,'GSE212','Entrepreneurship Education I',2,L2,'first'),
    (D_GSE,'GSE221','Computer Application',2,L2,'second'),
    (D_GSE,'GSE222','Entrepreneurship Education II',2,L2,'second'),
    (D_GSE,'GSE311','Communication in English IV',2,L3,'first'),
    (D_GSE,'GSE321','Peace and Conflict Resolution',2,L3,'second')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.courses (department_id, code, title, credit_units, level_id, semester_type) VALUES
    (D_EDF,'EDU111','Introduction to Teaching Profession',2,L1,'first'),
    (D_EDF,'EDU112','History of Education in Nigeria',2,L1,'first'),
    (D_EDF,'EDU121','Sociology of Education',2,L1,'second'),
    (D_PSY,'PSY121','Introduction to Educational Psychology',2,L1,'second'),
    (D_CUR,'CUR211','Curriculum Development I',2,L2,'first'),
    (D_PSY,'PSY211','Learning Theories and Applications',2,L2,'first'),
    (D_EDF,'EDU221','Philosophy of Education',2,L2,'second'),
    (D_CUR,'CUR221','Instructional Technology',2,L2,'second'),
    (D_EDF,'EDU311','Teaching Practice I',3,L3,'first'),
    (D_EDF,'EDU312','Measurement and Evaluation',2,L3,'first'),
    (D_EDF,'EDU321','Teaching Practice II',3,L3,'second'),
    (D_EDF,'EDU322','Research Project',3,L3,'second')
  ON CONFLICT (code) DO NOTHING;
END $seed$;

DO $subj$
DECLARE
  r RECORD;
  lvl RECORD;
  sem TEXT;
  n INT;
  v_code TEXT;
  v_title TEXT;
BEGIN
  FOR r IN SELECT d.id AS dept_id, d.code AS dept_code, d.name AS dept_name
           FROM public.departments d
           WHERE d.code IN ('ARA','BED','BIO','CHM','CSC','ENG','HAU','ISC','ISL','MTH','PHY','PED','SOC')
  LOOP
    FOR lvl IN SELECT l.id AS lvl_id, l.order_index FROM public.levels l ORDER BY l.order_index LOOP
      FOREACH sem IN ARRAY ARRAY['first','second'] LOOP
        FOR n IN 1..2 LOOP
          v_code := r.dept_code || lvl.order_index::TEXT || CASE WHEN sem='first' THEN '1' ELSE '2' END || n::TEXT;
          v_title := r.dept_name || ' ' || CASE
            WHEN lvl.order_index=1 AND sem='first' THEN 'Foundations '
            WHEN lvl.order_index=1 AND sem='second' THEN 'Principles '
            WHEN lvl.order_index=2 AND sem='first' THEN 'Methods '
            WHEN lvl.order_index=2 AND sem='second' THEN 'Applications '
            WHEN lvl.order_index=3 AND sem='first' THEN 'Advanced Topics '
            ELSE 'Special Topics '
          END || CASE n WHEN 1 THEN 'I' ELSE 'II' END;
          INSERT INTO public.courses (department_id, code, title, credit_units, level_id, semester_type)
          VALUES (r.dept_id, v_code, v_title, 2, lvl.lvl_id, sem::semester_type)
          ON CONFLICT (code) DO NOTHING;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END $subj$;
