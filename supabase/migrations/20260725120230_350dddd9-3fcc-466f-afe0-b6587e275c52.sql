
-- ================= Part 1: students decoupling =================

-- programmes extension (used later for BA Islamic Studies)
ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS award_type text NOT NULL DEFAULT 'nce',
  ADD COLUMN IF NOT EXISTS affiliated_institution text;

ALTER TABLE public.programmes
  DROP CONSTRAINT IF EXISTS programmes_award_type_chk;
ALTER TABLE public.programmes
  ADD CONSTRAINT programmes_award_type_chk CHECK (award_type IN ('nce','diploma','degree'));

-- students: new columns
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS default_password_changed boolean NOT NULL DEFAULT true;

-- Backfill auth_user_id from existing id (existing rows have id = auth.uid()).
UPDATE public.students SET auth_user_id = id WHERE auth_user_id IS NULL;

-- Drop the hard FK forcing students.id = auth.users.id.
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_id_fkey;

-- Independent primary-key default so imported/historical records can exist without a login.
ALTER TABLE public.students ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Unique + FK on auth_user_id.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_auth_user_id_key'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS students_auth_user_id_idx ON public.students(auth_user_id);

-- Helper: id of the student row owned by the currently signed-in user (if any).
CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.students WHERE auth_user_id = auth.uid() LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_student_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated;

-- ================= RLS rewrites =================
-- students
DROP POLICY IF EXISTS "Students read own record" ON public.students;
CREATE POLICY "Students read own record" ON public.students
FOR SELECT TO authenticated USING (
  auth_user_id = auth.uid()
  OR has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','bursary','dean','hod','lecturer']::app_role[])
);

-- course_registrations
DROP POLICY IF EXISTS "Students read own regs" ON public.course_registrations;
CREATE POLICY "Students read own regs" ON public.course_registrations
FOR SELECT TO authenticated USING (
  student_id = public.current_student_id()
  OR has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod','lecturer']::app_role[])
);

DROP POLICY IF EXISTS "Students insert own regs" ON public.course_registrations;
CREATE POLICY "Students insert own regs" ON public.course_registrations
FOR INSERT TO authenticated WITH CHECK (student_id = public.current_student_id());

DROP POLICY IF EXISTS "Students delete own pending regs" ON public.course_registrations;
CREATE POLICY "Students delete own pending regs" ON public.course_registrations
FOR DELETE TO authenticated USING (student_id = public.current_student_id() AND status = 'pending');

-- gpa_records
DROP POLICY IF EXISTS "Read own GPA" ON public.gpa_records;
CREATE POLICY "Read own GPA" ON public.gpa_records
FOR SELECT TO authenticated USING (
  student_id = public.current_student_id()
  OR has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod','lecturer']::app_role[])
);

-- payments
DROP POLICY IF EXISTS "Students read own payments" ON public.payments;
CREATE POLICY "Students read own payments" ON public.payments
FOR SELECT TO authenticated USING (
  student_id = public.current_student_id()
  OR has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','bursary']::app_role[])
);

-- results
DROP POLICY IF EXISTS "Students read published results" ON public.results;
CREATE POLICY "Students read published results" ON public.results
FOR SELECT TO authenticated USING (
  (student_id = public.current_student_id() AND status = 'published')
  OR EXISTS (
    SELECT 1 FROM course_lecturers cl
    WHERE cl.offering_id = results.offering_id AND cl.lecturer_id = auth.uid()
  )
  OR has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod']::app_role[])
);

-- result_history
DROP POLICY IF EXISTS "Read result history" ON public.result_history;
CREATE POLICY "Read result history" ON public.result_history
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM results r
    WHERE r.id = result_history.result_id
      AND (
        r.student_id = public.current_student_id()
        OR EXISTS (
          SELECT 1 FROM course_lecturers cl
          WHERE cl.offering_id = r.offering_id AND cl.lecturer_id = auth.uid()
        )
      )
  )
  OR has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','dean','hod']::app_role[])
);

-- standing_history
DROP POLICY IF EXISTS "Students read own standing history" ON public.standing_history;
CREATE POLICY "Students read own standing history" ON public.standing_history
FOR SELECT TO authenticated USING (
  student_id = public.current_student_id()
  OR has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost','dean','hod']::app_role[])
);

-- transcripts_issued
DROP POLICY IF EXISTS "Students see own transcripts" ON public.transcripts_issued;
CREATE POLICY "Students see own transcripts" ON public.transcripts_issued
FOR SELECT TO authenticated USING (
  student_id = public.current_student_id()
  OR has_any_role(auth.uid(), ARRAY['registry','super_admin','ict_admin','dean']::app_role[])
);

-- profiles (staff scoping uses s.auth_user_id = profiles.id, since profiles.id is the auth user id)
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost']::app_role[])
  OR (
    has_role(auth.uid(), 'dean'::app_role) AND EXISTS (
      SELECT 1 FROM students s
      JOIN departments d ON d.id = s.department_id
      JOIN faculties f ON f.id = d.faculty_id
      WHERE s.auth_user_id = profiles.id AND f.dean_id = auth.uid()
    )
  )
  OR (
    has_role(auth.uid(), 'hod'::app_role) AND EXISTS (
      SELECT 1 FROM students s
      JOIN departments d ON d.id = s.department_id
      WHERE s.auth_user_id = profiles.id AND d.hod_id = auth.uid()
    )
  )
  OR (
    has_role(auth.uid(), 'lecturer'::app_role) AND EXISTS (
      SELECT 1 FROM course_registrations cr
      JOIN course_lecturers cl ON cl.offering_id = cr.offering_id
      JOIN students s ON s.id = cr.student_id
      WHERE s.auth_user_id = profiles.id AND cl.lecturer_id = auth.uid()
    )
  )
);

-- ================= matriculate_application update =================
CREATE OR REPLACE FUNCTION public.matriculate_application(_application_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_app public.applications%ROWTYPE;
  v_dept UUID;
  v_level UUID;
  v_year INT;
  v_seq INT;
  v_matric TEXT;
  v_student_id UUID;
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

  -- Reuse existing student row for this auth user if present, else create a new one.
  SELECT id INTO v_student_id FROM public.students WHERE auth_user_id = v_app.user_id;
  IF v_student_id IS NULL THEN
    INSERT INTO public.students (auth_user_id, matric_number, programme_id, department_id, current_level_id, entry_session_id, entry_year, default_password_changed)
    VALUES (v_app.user_id, v_matric, v_app.programme_id, v_dept, v_level, v_app.entry_session_id, v_year, TRUE)
    RETURNING id INTO v_student_id;
  ELSE
    UPDATE public.students
      SET matric_number = v_matric,
          programme_id  = v_app.programme_id,
          department_id = v_dept,
          current_level_id = v_level,
          entry_session_id = v_app.entry_session_id,
          entry_year = v_year
      WHERE id = v_student_id;
  END IF;

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
$function$;

-- ================= Part 3: BA Islamic Studies (LVT) =================

-- 4 degree-programme levels
INSERT INTO public.levels (code, name, order_index) VALUES
  ('L100','Level 100', 100),
  ('L200','Level 200', 200),
  ('L300','Level 300', 300),
  ('L400','Level 400', 400)
ON CONFLICT (code) DO NOTHING;

-- Programme
INSERT INTO public.programmes (department_id, code, name, duration_years, award_type, affiliated_institution)
SELECT d.id, 'BA-ISL-LVT', 'B.A. Islamic Studies (LVT)', 4, 'degree', 'Federal University Dutsin-Ma (FUDMA)'
FROM public.departments d
WHERE d.code IN ('ISL','ISS','ISLS')
   OR lower(d.name) LIKE '%islamic%'
LIMIT 1
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  duration_years = EXCLUDED.duration_years,
  award_type = EXCLUDED.award_type,
  affiliated_institution = EXCLUDED.affiliated_institution;

-- Seed courses: helper CTEs to pick department + levels
WITH prog AS (
  SELECT id AS programme_id, department_id FROM public.programmes WHERE code = 'BA-ISL-LVT'
),
lvl AS (
  SELECT code, id FROM public.levels WHERE code IN ('L100','L200','L300','L400')
),
seed(code, title, credit_units, level_code, semester_type, category) AS (
  VALUES
    -- Level 100
    ('ISL111','Introduction to the Study of Islam',2,'L100','first','subject_major'),
    ('ISL121','Qur''anic Studies I',2,'L100','first','subject_major'),
    ('ISL122','Qur''anic Studies II',2,'L100','second','subject_major'),
    ('ISL132','Hadith Studies I',2,'L100','second','subject_major'),
    ('ISL142','Introduction to Fiqh (Islamic Jurisprudence)',2,'L100','second','subject_major'),
    ('ISL151','Arabic Grammar I (Nahw)',2,'L100','first','subject_major'),
    ('ISL152','Arabic Grammar II (Sarf)',2,'L100','second','subject_major'),
    ('GST111','Communication in English',2,'L100','first','general_studies'),
    ('GST112','Nigerian Peoples and Culture',2,'L100','second','general_studies'),
    ('GST122','Communication in English II',2,'L100','second','general_studies'),
    -- Level 200
    ('ISL211','History of Islamic Civilisation',2,'L200','first','subject_major'),
    ('ISL212','Sirah of Prophet Muhammad (SAW)',2,'L200','second','subject_major'),
    ('ISL221','Tafsir I (Exegesis of the Qur''an)',2,'L200','first','subject_major'),
    ('ISL222','Tafsir II',2,'L200','second','subject_major'),
    ('ISL231','Hadith Studies II',2,'L200','first','subject_major'),
    ('ISL232','Sciences of Hadith (Ulum al-Hadith)',2,'L200','second','subject_major'),
    ('ISL241','Fiqh of Ibadat',2,'L200','first','subject_major'),
    ('ISL242','Fiqh of Muamalat',2,'L200','second','subject_major'),
    ('ISL251','Arabic Composition and Comprehension',2,'L200','first','subject_major'),
    ('ISL252','Arabic Literature I',2,'L200','second','subject_major'),
    ('ISL261','Aqidah (Islamic Creed) I',2,'L200','first','subject_major'),
    ('ISL262','Aqidah II',2,'L200','second','subject_major'),
    ('ISL271','Islam in West Africa',2,'L200','first','subject_major'),
    ('GST212','Philosophy and Logic',2,'L200','second','general_studies'),
    ('GST221','Peace Studies and Conflict Resolution',2,'L200','first','general_studies'),
    ('GST231','Introduction to Entrepreneurial Studies',2,'L200','first','general_studies'),
    ('GST232','Environment and Sustainable Development',2,'L200','second','general_studies'),
    -- Level 300
    ('ISL311','Comparative Study of Religions',2,'L300','first','subject_major'),
    ('ISL312','Islamic Political Thought',2,'L300','second','subject_major'),
    ('ISL321','Tafsir III',2,'L300','first','subject_major'),
    ('ISL322','Themes in the Qur''an',2,'L300','second','subject_major'),
    ('ISL331','Hadith Studies III',2,'L300','first','subject_major'),
    ('ISL332','Selected Hadith Texts',2,'L300','second','subject_major'),
    ('ISL341','Usul al-Fiqh (Principles of Islamic Jurisprudence)',2,'L300','first','subject_major'),
    ('ISL351','Arabic Literature II',2,'L300','first','subject_major'),
    ('ISL361','Islamic Ethics and Sufism',2,'L300','first','subject_major'),
    ('ISL371','Islam in Northern Nigeria',2,'L300','first','subject_major'),
    ('ISL381','Research Methodology in Islamic Studies',2,'L300','first','subject_major'),
    ('GST311','Entrepreneurship and Innovation',2,'L300','first','general_studies')
)
INSERT INTO public.courses (department_id, code, title, credit_units, level_id, semester_type, category, is_active)
SELECT p.department_id, s.code, s.title, s.credit_units, l.id, s.semester_type::semester_type, s.category, TRUE
FROM seed s
JOIN prog p ON TRUE
JOIN lvl l ON l.code = s.level_code
ON CONFLICT (code) DO NOTHING;
