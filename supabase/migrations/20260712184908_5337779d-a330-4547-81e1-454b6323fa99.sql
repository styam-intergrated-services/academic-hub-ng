
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM (
  'super_admin','ict_admin','registry','bursary','dean','hod','lecturer','student','applicant'
);

CREATE TYPE public.session_status AS ENUM ('upcoming','active','archived','closed');
CREATE TYPE public.semester_type AS ENUM ('first','second');
CREATE TYPE public.registration_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.result_status AS ENUM (
  'draft','submitted','hod_approved','hod_rejected','dean_approved','dean_rejected','registry_approved','registry_rejected','published'
);
CREATE TYPE public.academic_standing AS ENUM ('excellent','good','probation','withdrawn');
CREATE TYPE public.payment_status AS ENUM ('pending','verified','failed','refunded');

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male','female')),
  address TEXT,
  state_of_origin TEXT,
  lga TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER ROLES  (separate table — never on profiles)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles)) $$;

CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS SETOF public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = auth.uid() $$;

-- Profiles policies
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod','lecturer']::public.app_role[]));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]));

-- User roles policies
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]));

-- ============================================================
-- ACADEMIC STRUCTURE
-- ============================================================
CREATE TABLE public.faculties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  dean_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID NOT NULL REFERENCES public.faculties(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  hod_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(faculty_id, name)
);

CREATE TABLE public.programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  duration_years INT NOT NULL DEFAULT 3 CHECK (duration_years BETWEEN 1 AND 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,      -- e.g. 'NCE1','NCE2','NCE3'
  name TEXT NOT NULL,
  order_index INT NOT NULL
);

CREATE TABLE public.academic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,      -- e.g. '2025/2026'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status public.session_status NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);

-- Ensure only one active session at a time via partial unique index
CREATE UNIQUE INDEX one_active_session ON public.academic_sessions(status) WHERE status = 'active';

CREATE TABLE public.semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  type public.semester_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  registration_open BOOLEAN NOT NULL DEFAULT false,
  registration_start TIMESTAMPTZ,
  registration_end TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(session_id, type)
);
CREATE UNIQUE INDEX one_current_semester ON public.semesters(is_current) WHERE is_current = true;

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,      -- e.g. 'EDU111'
  title TEXT NOT NULL,
  credit_units INT NOT NULL CHECK (credit_units BETWEEN 1 AND 12),
  level_id UUID NOT NULL REFERENCES public.levels(id),
  semester_type public.semester_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.course_prerequisites (
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  prerequisite_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, prerequisite_id),
  CHECK (course_id <> prerequisite_id)
);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE public.students (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  matric_number TEXT NOT NULL UNIQUE,
  programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  current_level_id UUID NOT NULL REFERENCES public.levels(id),
  entry_session_id UUID REFERENCES public.academic_sessions(id),
  entry_year INT,
  cgpa NUMERIC(4,2) NOT NULL DEFAULT 0.00,
  total_credit_units INT NOT NULL DEFAULT 0,
  total_grade_points NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  standing public.academic_standing NOT NULL DEFAULT 'good',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_dept ON public.students(department_id);
CREATE INDEX idx_students_prog ON public.students(programme_id);
CREATE INDEX idx_students_level ON public.students(current_level_id);

-- ============================================================
-- COURSE OFFERINGS (a course in a specific semester with lecturers)
-- ============================================================
CREATE TABLE public.course_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  max_students INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, semester_id)
);

CREATE TABLE public.course_lecturers (
  offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  lecturer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_lead BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (offering_id, lecturer_id)
);
CREATE INDEX idx_course_lecturers_lecturer ON public.course_lecturers(lecturer_id);

-- ============================================================
-- FEES & PAYMENTS (minimal foundation — full processor later)
-- ============================================================
CREATE TABLE public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES public.levels(id),
  programme_id UUID REFERENCES public.programmes(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL,
  UNIQUE(session_id, level_id, programme_id)
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id),
  fee_structure_id UUID REFERENCES public.fee_structures(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference TEXT NOT NULL UNIQUE,
  provider TEXT,                       -- 'remita' | 'paystack' | 'flutterwave' | 'manual'
  status public.payment_status NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_student ON public.payments(student_id);

-- ============================================================
-- COURSE REGISTRATIONS
-- ============================================================
CREATE TABLE public.course_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE RESTRICT,
  status public.registration_status NOT NULL DEFAULT 'pending',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, offering_id)
);
CREATE INDEX idx_reg_student ON public.course_registrations(student_id);
CREATE INDEX idx_reg_offering ON public.course_registrations(offering_id);

-- ============================================================
-- RESULTS  (approval workflow)
-- ============================================================
CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL UNIQUE REFERENCES public.course_registrations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE RESTRICT,
  ca_score NUMERIC(5,2) CHECK (ca_score >= 0 AND ca_score <= 40),
  exam_score NUMERIC(5,2) CHECK (exam_score >= 0 AND exam_score <= 60),
  total_score NUMERIC(5,2) GENERATED ALWAYS AS (COALESCE(ca_score,0) + COALESCE(exam_score,0)) STORED,
  grade TEXT,
  grade_point NUMERIC(3,1),
  status public.result_status NOT NULL DEFAULT 'draft',
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  hod_approved_by UUID REFERENCES auth.users(id),
  hod_approved_at TIMESTAMPTZ,
  dean_approved_by UUID REFERENCES auth.users(id),
  dean_approved_at TIMESTAMPTZ,
  registry_approved_by UUID REFERENCES auth.users(id),
  registry_approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_results_student ON public.results(student_id);
CREATE INDEX idx_results_offering ON public.results(offering_id);
CREATE INDEX idx_results_status ON public.results(status);

-- Result history (version log)
CREATE TABLE public.result_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES public.results(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  from_status public.result_status,
  to_status public.result_status,
  ca_score NUMERIC(5,2),
  exam_score NUMERIC(5,2),
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_result_history_result ON public.result_history(result_id);

-- GPA records (semester-level)
CREATE TABLE public.gpa_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  gpa NUMERIC(4,2) NOT NULL DEFAULT 0.00,
  cgpa NUMERIC(4,2) NOT NULL DEFAULT 0.00,
  credit_units INT NOT NULL DEFAULT 0,
  grade_points NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  standing public.academic_standing NOT NULL DEFAULT 'good',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, semester_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  category TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, is_read);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id, created_at DESC);

-- ============================================================
-- GRANTS
-- ============================================================
GRANT SELECT ON public.faculties, public.departments, public.programmes, public.levels,
                 public.academic_sessions, public.semesters, public.courses, public.course_prerequisites,
                 public.course_offerings, public.course_lecturers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.faculties, public.departments, public.programmes, public.levels,
                 public.academic_sessions, public.semesters, public.courses, public.course_prerequisites,
                 public.course_offerings, public.course_lecturers TO authenticated;
GRANT ALL ON public.faculties, public.departments, public.programmes, public.levels,
                 public.academic_sessions, public.semesters, public.courses, public.course_prerequisites,
                 public.course_offerings, public.course_lecturers TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_structures, public.payments,
                 public.course_registrations, public.results, public.result_history,
                 public.gpa_records, public.notifications, public.audit_logs TO authenticated;
GRANT ALL ON public.fee_structures, public.payments,
                 public.course_registrations, public.results, public.result_history,
                 public.gpa_records, public.notifications, public.audit_logs TO service_role;

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lecturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gpa_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES: Academic reference data — readable by all authenticated, writable by admins/registry
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['faculties','departments','programmes','levels','academic_sessions','semesters','courses','course_prerequisites','course_offerings','course_lecturers']
  LOOP
    EXECUTE format('CREATE POLICY "auth read %I" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "admins write %I" ON public.%I FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY[''super_admin'',''ict_admin'',''registry'']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY[''super_admin'',''ict_admin'',''registry'']::public.app_role[]))', t, t);
  END LOOP;
END $$;

-- ============================================================
-- POLICIES: STUDENTS
-- ============================================================
CREATE POLICY "Students read own record" ON public.students FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','bursary','dean','hod','lecturer']::public.app_role[])
  );
CREATE POLICY "Admins manage students" ON public.students FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]));

-- ============================================================
-- POLICIES: FEES / PAYMENTS
-- ============================================================
CREATE POLICY "Students read own payments" ON public.payments FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','bursary']::public.app_role[]));
CREATE POLICY "Bursary manages payments" ON public.payments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','bursary']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','bursary']::public.app_role[]));
CREATE POLICY "auth read fee_structures" ON public.fee_structures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Bursary manages fees" ON public.fee_structures FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','bursary','registry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','bursary','registry']::public.app_role[]));

-- ============================================================
-- POLICIES: COURSE REGISTRATIONS
-- ============================================================
CREATE POLICY "Students read own regs" ON public.course_registrations FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod','lecturer']::public.app_role[])
  );
CREATE POLICY "Students insert own regs" ON public.course_registrations FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students delete own pending regs" ON public.course_registrations FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending');
CREATE POLICY "Registry manages regs" ON public.course_registrations FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]));

-- ============================================================
-- POLICIES: RESULTS — students see only their PUBLISHED results
-- ============================================================
CREATE POLICY "Students read published results" ON public.results FOR SELECT TO authenticated
  USING (
    (student_id = auth.uid() AND status = 'published')
    OR EXISTS (
      SELECT 1 FROM public.course_lecturers cl
      WHERE cl.offering_id = results.offering_id AND cl.lecturer_id = auth.uid()
    )
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod']::public.app_role[])
  );
CREATE POLICY "Lecturers upsert results" ON public.results FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_lecturers cl
      WHERE cl.offering_id = offering_id AND cl.lecturer_id = auth.uid()
    )
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[])
  );
CREATE POLICY "Result approvers update" ON public.results FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_lecturers cl
      WHERE cl.offering_id = results.offering_id AND cl.lecturer_id = auth.uid()
    )
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod']::public.app_role[])
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_lecturers cl
      WHERE cl.offering_id = results.offering_id AND cl.lecturer_id = auth.uid()
    )
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod']::public.app_role[])
  );

CREATE POLICY "Read result history" ON public.result_history FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.results r
            WHERE r.id = result_history.result_id
              AND (r.student_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.course_lecturers cl WHERE cl.offering_id = r.offering_id AND cl.lecturer_id = auth.uid())))
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod']::public.app_role[])
  );
CREATE POLICY "Insert result history" ON public.result_history FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid());

CREATE POLICY "Read own GPA" ON public.gpa_records FOR SELECT TO authenticated
  USING (student_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod','lecturer']::public.app_role[]));
CREATE POLICY "System writes GPA" ON public.gpa_records FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]));

-- Notifications: user owns
CREATE POLICY "Read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "System insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','bursary','dean','hod','lecturer']::public.app_role[]) OR user_id = auth.uid());

-- Audit logs: admin read only, everyone can insert own
CREATE POLICY "Admins read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin']::public.app_role[]));
CREATE POLICY "Insert own audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- ============================================================
-- FUNCTIONS + TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_faculties_updated BEFORE UPDATE ON public.faculties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_results_updated BEFORE UPDATE ON public.results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto profile + student trigger on signup: just create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grade computation (5-point NCE scale): A=5,B=4,C=3,D=2,E=1,F=0
CREATE OR REPLACE FUNCTION public.compute_grade(_score NUMERIC)
RETURNS TABLE(grade TEXT, grade_point NUMERIC) LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF _score IS NULL THEN RETURN QUERY SELECT NULL::TEXT, NULL::NUMERIC; RETURN; END IF;
  IF _score >= 75 THEN RETURN QUERY SELECT 'A'::TEXT, 5.0::NUMERIC;
  ELSIF _score >= 65 THEN RETURN QUERY SELECT 'B'::TEXT, 4.0::NUMERIC;
  ELSIF _score >= 55 THEN RETURN QUERY SELECT 'C'::TEXT, 3.0::NUMERIC;
  ELSIF _score >= 45 THEN RETURN QUERY SELECT 'D'::TEXT, 2.0::NUMERIC;
  ELSIF _score >= 40 THEN RETURN QUERY SELECT 'E'::TEXT, 1.0::NUMERIC;
  ELSE RETURN QUERY SELECT 'F'::TEXT, 0.0::NUMERIC;
  END IF;
END; $$;

-- Auto-fill grade + grade_point on result write
CREATE OR REPLACE FUNCTION public.fill_result_grade()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE g RECORD; total NUMERIC;
BEGIN
  total := COALESCE(NEW.ca_score,0) + COALESCE(NEW.exam_score,0);
  SELECT * INTO g FROM public.compute_grade(total);
  NEW.grade := g.grade;
  NEW.grade_point := g.grade_point;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_result_grade BEFORE INSERT OR UPDATE OF ca_score, exam_score ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.fill_result_grade();

-- Log result changes
CREATE OR REPLACE FUNCTION public.log_result_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status
     OR OLD.ca_score IS DISTINCT FROM NEW.ca_score OR OLD.exam_score IS DISTINCT FROM NEW.exam_score THEN
    INSERT INTO public.result_history(result_id, changed_by, action, from_status, to_status, ca_score, exam_score)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.submitted_by),
            CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,
            CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
            NEW.status, NEW.ca_score, NEW.exam_score);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_result_history AFTER INSERT OR UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.log_result_change();

-- Recompute student CGPA + standing when a result is published
CREATE OR REPLACE FUNCTION public.recompute_student_cgpa(_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_units INT; v_total_points NUMERIC; v_cgpa NUMERIC; v_standing public.academic_standing;
BEGIN
  SELECT COALESCE(SUM(c.credit_units),0),
         COALESCE(SUM(c.credit_units * r.grade_point),0)
    INTO v_total_units, v_total_points
  FROM public.results r
  JOIN public.course_offerings o ON o.id = r.offering_id
  JOIN public.courses c ON c.id = o.course_id
  WHERE r.student_id = _student_id AND r.status = 'published';

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

-- Recompute semester GPA record for a student+semester
CREATE OR REPLACE FUNCTION public.recompute_semester_gpa(_student_id UUID, _semester_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_units INT; v_points NUMERIC; v_gpa NUMERIC; v_std public.academic_standing; v_cgpa NUMERIC;
BEGIN
  SELECT COALESCE(SUM(c.credit_units),0),
         COALESCE(SUM(c.credit_units * r.grade_point),0)
    INTO v_units, v_points
  FROM public.results r
  JOIN public.course_offerings o ON o.id = r.offering_id
  JOIN public.courses c ON c.id = o.course_id
  WHERE r.student_id = _student_id AND o.semester_id = _semester_id AND r.status = 'published';

  IF v_units = 0 THEN v_gpa := 0; ELSE v_gpa := ROUND(v_points / v_units, 2); END IF;

  SELECT cgpa INTO v_cgpa FROM public.students WHERE id = _student_id;
  v_std := CASE WHEN v_gpa >= 4.5 THEN 'excellent' WHEN v_gpa >= 2.0 THEN 'good' WHEN v_gpa >= 1.0 THEN 'probation' ELSE 'withdrawn' END::public.academic_standing;

  INSERT INTO public.gpa_records(student_id, semester_id, gpa, cgpa, credit_units, grade_points, standing, computed_at)
  VALUES (_student_id, _semester_id, v_gpa, COALESCE(v_cgpa,0), v_units, v_points, v_std, now())
  ON CONFLICT (student_id, semester_id)
  DO UPDATE SET gpa=EXCLUDED.gpa, cgpa=EXCLUDED.cgpa, credit_units=EXCLUDED.credit_units,
                grade_points=EXCLUDED.grade_points, standing=EXCLUDED.standing, computed_at=now();
END; $$;

CREATE OR REPLACE FUNCTION public.on_result_published()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_semester UUID;
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published') THEN
    NEW.published_at := now();
    SELECT semester_id INTO v_semester FROM public.course_offerings WHERE id = NEW.offering_id;
    PERFORM public.recompute_student_cgpa(NEW.student_id);
    PERFORM public.recompute_semester_gpa(NEW.student_id, v_semester);
    INSERT INTO public.notifications(user_id, title, body, category)
    VALUES (NEW.student_id, 'Result Published', 'A new course result has been published.', 'result');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_result_published BEFORE UPDATE OF status ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.on_result_published();

-- Registration validation trigger
CREATE OR REPLACE FUNCTION public.validate_registration()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reg_open BOOLEAN; v_units INT; v_current_units INT; v_course_units INT;
BEGIN
  SELECT s.registration_open INTO v_reg_open
  FROM public.course_offerings o JOIN public.semesters s ON s.id = o.semester_id
  WHERE o.id = NEW.offering_id;
  IF NOT COALESCE(v_reg_open,false) THEN
    RAISE EXCEPTION 'Registration is not open for this semester';
  END IF;

  SELECT c.credit_units INTO v_course_units
  FROM public.course_offerings o JOIN public.courses c ON c.id = o.course_id
  WHERE o.id = NEW.offering_id;

  SELECT COALESCE(SUM(c.credit_units),0) INTO v_current_units
  FROM public.course_registrations cr
  JOIN public.course_offerings o ON o.id = cr.offering_id
  JOIN public.courses c ON c.id = o.course_id
  WHERE cr.student_id = NEW.student_id AND o.semester_id = (
    SELECT semester_id FROM public.course_offerings WHERE id = NEW.offering_id
  );

  IF v_current_units + v_course_units > 24 THEN
    RAISE EXCEPTION 'Maximum credit units (24) exceeded';
  END IF;

  RETURN NEW;
END; $$;
CREATE TRIGGER trg_validate_registration BEFORE INSERT ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION public.validate_registration();

-- Seed default levels
INSERT INTO public.levels (code, name, order_index) VALUES
  ('NCE1','NCE Year 1',1),('NCE2','NCE Year 2',2),('NCE3','NCE Year 3',3)
ON CONFLICT (code) DO NOTHING;
