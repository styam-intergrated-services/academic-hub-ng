
-- 1. Course categories
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='courses' AND column_name='category') THEN
    ALTER TABLE public.courses ADD COLUMN category TEXT NOT NULL DEFAULT 'subject_major';
    ALTER TABLE public.courses ADD CONSTRAINT courses_category_check
      CHECK (category IN ('education','general_studies','subject_major','teaching_practice','siwes','elective'));
  END IF;
END $$;

-- Classify already-seeded GSE and EDU courses so eligibility isn't blocked by defaults.
UPDATE public.courses SET category='general_studies' WHERE code LIKE 'GSE%' AND category='subject_major';
UPDATE public.courses SET category='education' WHERE code LIKE 'EDU%' AND category='subject_major';

-- Teaching Practice (6 credits, NCE3 first semester) and SIWES (1 credit each in NCE1/NCE2 second semester).
DO $$
DECLARE
  v_dept_edf UUID; v_nce1 UUID; v_nce2 UUID; v_nce3 UUID;
BEGIN
  SELECT id INTO v_dept_edf FROM public.departments WHERE code='EDF';
  SELECT id INTO v_nce1 FROM public.levels WHERE code='NCE1';
  SELECT id INTO v_nce2 FROM public.levels WHERE code='NCE2';
  SELECT id INTO v_nce3 FROM public.levels WHERE code='NCE3';
  IF v_dept_edf IS NOT NULL AND v_nce3 IS NOT NULL THEN
    INSERT INTO public.courses (department_id, code, title, credit_units, level_id, semester_type, is_active, description, category)
    VALUES (v_dept_edf, 'TPR301', 'Teaching Practice (Full Term)', 6, v_nce3, 'first', true, 'Supervised Teaching Practice per NCCE minimum standards.', 'teaching_practice')
    ON CONFLICT (code) DO UPDATE SET credit_units=EXCLUDED.credit_units, category='teaching_practice', level_id=EXCLUDED.level_id, semester_type=EXCLUDED.semester_type;
  END IF;
  IF v_dept_edf IS NOT NULL AND v_nce1 IS NOT NULL THEN
    INSERT INTO public.courses (department_id, code, title, credit_units, level_id, semester_type, is_active, description, category)
    VALUES (v_dept_edf, 'SIW101', 'SIWES I (Year 1)', 1, v_nce1, 'second', true, 'Students Industrial Work Experience Scheme — 4 weeks in NCE1.', 'siwes')
    ON CONFLICT (code) DO UPDATE SET credit_units=1, category='siwes', level_id=EXCLUDED.level_id, semester_type=EXCLUDED.semester_type;
  END IF;
  IF v_dept_edf IS NOT NULL AND v_nce2 IS NOT NULL THEN
    INSERT INTO public.courses (department_id, code, title, credit_units, level_id, semester_type, is_active, description, category)
    VALUES (v_dept_edf, 'SIW201', 'SIWES II (Year 2)', 1, v_nce2, 'second', true, 'Students Industrial Work Experience Scheme — 4 weeks in NCE2.', 'siwes')
    ON CONFLICT (code) DO UPDATE SET credit_units=1, category='siwes', level_id=EXCLUDED.level_id, semester_type=EXCLUDED.semester_type;
  END IF;
END $$;

-- 2. Graduation eligibility function
CREATE OR REPLACE FUNCTION public.check_graduation_eligibility(_student_id UUID)
RETURNS TABLE(
  eligible BOOLEAN,
  cgpa NUMERIC,
  total_credits_earned INT,
  education_credits INT,
  general_studies_credits INT,
  subject_major_credits INT,
  teaching_practice_completed BOOLEAN,
  siwes_completed BOOLEAN,
  standing public.academic_standing,
  reasons TEXT[]
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cgpa NUMERIC; v_standing public.academic_standing;
  v_edu INT; v_gs INT; v_sm INT; v_tp INT; v_si INT; v_total INT;
  v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT s.cgpa, s.standing INTO v_cgpa, v_standing FROM public.students s WHERE s.id = _student_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 0, 0, 0, 0, FALSE, FALSE, NULL::public.academic_standing, ARRAY['Student not found']::TEXT[];
    RETURN;
  END IF;

  WITH earned AS (
    SELECT c.category, SUM(c.credit_units)::INT AS cu
    FROM public.results r
    JOIN public.course_offerings o ON o.id = r.offering_id
    JOIN public.courses c ON c.id = o.course_id
    WHERE r.student_id = _student_id
      AND r.status = 'published' AND r.status_code = 'OK' AND r.grade_point > 0
    GROUP BY c.category
  )
  SELECT
    COALESCE(SUM(CASE WHEN category='education' THEN cu END),0)::INT,
    COALESCE(SUM(CASE WHEN category='general_studies' THEN cu END),0)::INT,
    COALESCE(SUM(CASE WHEN category='subject_major' THEN cu END),0)::INT,
    COALESCE(SUM(CASE WHEN category='teaching_practice' THEN cu END),0)::INT,
    COALESCE(SUM(CASE WHEN category='siwes' THEN cu END),0)::INT,
    COALESCE(SUM(cu),0)::INT
  INTO v_edu, v_gs, v_sm, v_tp, v_si, v_total
  FROM earned;

  IF v_cgpa < 1.00 THEN v_reasons := array_append(v_reasons, 'CGPA ' || v_cgpa || ' is below the minimum 1.00 required for graduation.'); END IF;
  IF v_edu < 24 THEN v_reasons := array_append(v_reasons, 'Education credits earned (' || v_edu || ') below required 24.'); END IF;
  IF v_gs < 16 THEN v_reasons := array_append(v_reasons, 'General Studies credits earned (' || v_gs || ') below required 16.'); END IF;
  IF v_sm < 48 THEN v_reasons := array_append(v_reasons, 'Subject-major credits earned (' || v_sm || ') below required 48 (combined across both teaching subjects).'); END IF;
  IF v_tp < 6 THEN v_reasons := array_append(v_reasons, 'Teaching Practice not completed (need 6 credits, earned ' || v_tp || ').'); END IF;
  IF v_si < 2 THEN v_reasons := array_append(v_reasons, 'SIWES not completed (need 2 credits total, earned ' || v_si || ').'); END IF;
  IF v_total < 95 THEN v_reasons := array_append(v_reasons, 'Total earned credits (' || v_total || ') below required 95.'); END IF;
  IF v_standing = 'withdrawn' THEN v_reasons := array_append(v_reasons, 'Student standing is withdrawn.'); END IF;

  RETURN QUERY SELECT
    (array_length(v_reasons,1) IS NULL),
    v_cgpa, v_total, v_edu, v_gs, v_sm,
    (v_tp >= 6), (v_si >= 2),
    v_standing,
    v_reasons;
END $$;

REVOKE EXECUTE ON FUNCTION public.check_graduation_eligibility(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_graduation_eligibility(UUID) TO authenticated;

-- 3. Standing history
CREATE TABLE IF NOT EXISTS public.standing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL,
  cgpa_at_time NUMERIC(4,2),
  gpa_at_time NUMERIC(4,2),
  standing public.academic_standing NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_standing_history_student ON public.standing_history(student_id, created_at DESC);

GRANT SELECT ON public.standing_history TO authenticated;
GRANT ALL ON public.standing_history TO service_role;

ALTER TABLE public.standing_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own standing history" ON public.standing_history;
CREATE POLICY "Students read own standing history" ON public.standing_history
  FOR SELECT TO authenticated
  USING (student_id = auth.uid()
         OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost','dean','hod']::app_role[]));

-- No INSERT/UPDATE/DELETE policies — writes only via SECURITY DEFINER functions.

-- 4. Update semester GPA recomputation to be stateful
CREATE OR REPLACE FUNCTION public.recompute_semester_gpa(_student_id uuid, _semester_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_units INT; v_points NUMERIC; v_gpa NUMERIC;
  v_new_std public.academic_standing;
  v_prev_std public.academic_standing;
  v_cur_std public.academic_standing;
  v_cgpa NUMERIC;
  v_reason TEXT;
  v_notify_title TEXT;
  v_notify_body TEXT;
BEGIN
  SELECT COALESCE(SUM(c.credit_units),0),
         COALESCE(SUM(c.credit_units * r.grade_point),0)
    INTO v_units, v_points
  FROM public.results r
  JOIN public.course_offerings o ON o.id = r.offering_id
  JOIN public.courses c ON c.id = o.course_id
  WHERE r.student_id = _student_id AND o.semester_id = _semester_id
    AND r.status = 'published' AND r.status_code = 'OK';

  IF v_units = 0 THEN v_gpa := 0; ELSE v_gpa := ROUND(v_points / v_units, 2); END IF;

  SELECT cgpa, standing INTO v_cgpa, v_cur_std FROM public.students WHERE id = _student_id;

  -- Most recent prior standing (strictly before this recomputation moment for the same student)
  SELECT sh.standing INTO v_prev_std
  FROM public.standing_history sh
  WHERE sh.student_id = _student_id
    AND (sh.semester_id IS DISTINCT FROM _semester_id)
  ORDER BY sh.created_at DESC LIMIT 1;

  IF v_gpa >= 1.00 AND COALESCE(v_cgpa,0) >= 1.00 THEN
    IF COALESCE(v_cgpa,0) >= 4.5 THEN v_new_std := 'excellent'; ELSE v_new_std := 'good'; END IF;
    v_reason := 'Semester GPA ' || v_gpa || ' and CGPA ' || COALESCE(v_cgpa,0) || ' at or above 1.00.';
  ELSIF v_gpa < 1.00 THEN
    IF v_prev_std = 'probation' THEN
      v_new_std := 'withdrawn';
      v_reason := 'Second consecutive semester below 1.00 GPA (current ' || v_gpa || '); withdrawn per academic regulations.';
    ELSE
      v_new_std := 'probation';
      v_reason := 'Semester GPA ' || v_gpa || ' below 1.00; first occurrence, placed on probation.';
    END IF;
  ELSE
    -- semester ok but CGPA below 1: keep or place on probation similar to before
    IF v_prev_std = 'probation' THEN
      v_new_std := 'withdrawn';
      v_reason := 'CGPA remains below 1.00 after probation semester; withdrawn.';
    ELSE
      v_new_std := 'probation';
      v_reason := 'CGPA ' || COALESCE(v_cgpa,0) || ' below 1.00; placed on probation.';
    END IF;
  END IF;

  INSERT INTO public.gpa_records(student_id, semester_id, gpa, cgpa, credit_units, grade_points, standing, computed_at)
  VALUES (_student_id, _semester_id, v_gpa, COALESCE(v_cgpa,0), v_units, v_points, v_new_std, now())
  ON CONFLICT (student_id, semester_id)
  DO UPDATE SET gpa=EXCLUDED.gpa, cgpa=EXCLUDED.cgpa, credit_units=EXCLUDED.credit_units,
                grade_points=EXCLUDED.grade_points, standing=EXCLUDED.standing, computed_at=now();

  INSERT INTO public.standing_history(student_id, semester_id, cgpa_at_time, gpa_at_time, standing, reason)
  VALUES (_student_id, _semester_id, COALESCE(v_cgpa,0), v_gpa, v_new_std, v_reason);

  UPDATE public.students SET standing = v_new_std WHERE id = _student_id;

  IF v_new_std IN ('probation','withdrawn') AND v_new_std IS DISTINCT FROM v_cur_std THEN
    IF v_new_std = 'probation' THEN
      v_notify_title := 'Academic Probation';
      v_notify_body := 'Your academic standing has been set to probation. ' || v_reason || ' Please meet your HOD/Dean for advisement.';
    ELSE
      v_notify_title := 'Academic Withdrawal';
      v_notify_body := 'Your academic standing has been set to withdrawn. ' || v_reason;
    END IF;
    INSERT INTO public.notifications(user_id, title, body, category)
    VALUES (_student_id, v_notify_title, v_notify_body, 'academic_standing');
  END IF;
END; $function$;

-- Ensure recompute_student_cgpa no longer overwrites standing (delegated to semester recomputation).
CREATE OR REPLACE FUNCTION public.recompute_student_cgpa(_student_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_units INT; v_total_points NUMERIC; v_cgpa NUMERIC;
BEGIN
  SELECT COALESCE(SUM(c.credit_units),0),
         COALESCE(SUM(c.credit_units * r.grade_point),0)
    INTO v_total_units, v_total_points
  FROM public.results r
  JOIN public.course_offerings o ON o.id = r.offering_id
  JOIN public.courses c ON c.id = o.course_id
  WHERE r.student_id = _student_id AND r.status = 'published' AND r.status_code = 'OK';

  IF v_total_units = 0 THEN v_cgpa := 0; ELSE v_cgpa := ROUND(v_total_points / v_total_units, 2); END IF;

  UPDATE public.students SET
    cgpa = v_cgpa, total_credit_units = v_total_units,
    total_grade_points = v_total_points
  WHERE id = _student_id;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.recompute_semester_gpa(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_student_cgpa(uuid) FROM PUBLIC, anon, authenticated;
