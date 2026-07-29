CREATE OR REPLACE FUNCTION public.admin_bulk_import_results(_payload jsonb, _dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_session_name text;
  v_publish boolean;
  v_session_id uuid;
  v_row jsonb;
  v_idx int := 0;
  v_matric text;
  v_course_code text;
  v_course_title text;
  v_units int;
  v_category text;
  v_contact int;
  v_score numeric;
  v_ca numeric;
  v_exam numeric;
  v_status_code text;
  v_student_id uuid;
  v_dept_id uuid;
  v_level_id uuid;
  v_semester_id uuid;
  v_course_id uuid;
  v_offering_id uuid;
  v_registration_id uuid;
  v_result_id uuid;
  v_sem_created int := 0;
  v_courses_created int := 0;
  v_offerings_created int := 0;
  v_regs_created int := 0;
  v_results_created int := 0;
  v_results_updated int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_students uuid[] := ARRAY[]::uuid[];
  v_sid uuid;
  v_start date;
BEGIN
  IF NOT (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[])
          OR current_user = 'postgres') THEN
    RAISE EXCEPTION 'Not authorized to import results';
  END IF;

  v_actor := COALESCE(auth.uid(), (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'::public.app_role ORDER BY created_at LIMIT 1));
  v_session_name := COALESCE(_payload->>'session_name', '');
  v_publish := COALESCE((_payload->>'publish')::boolean, true);

  IF v_session_name = '' THEN RAISE EXCEPTION 'session_name is required'; END IF;

  PERFORM set_config('app.import_mode', 'true', true);

  SELECT id INTO v_session_id FROM public.academic_sessions WHERE name = v_session_name LIMIT 1;
  IF v_session_id IS NULL THEN
    v_start := make_date(COALESCE(NULLIF(regexp_replace(v_session_name, '\D.*$', ''), '')::int, EXTRACT(YEAR FROM CURRENT_DATE)::int), 9, 1);
    IF _dry_run THEN
      v_session_id := gen_random_uuid();
    ELSE
      INSERT INTO public.academic_sessions (name, start_date, end_date, status)
      VALUES (v_session_name, v_start, v_start + INTERVAL '11 months', 'archived')
      RETURNING id INTO v_session_id;
    END IF;
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(COALESCE(_payload->'rows', '[]'::jsonb)) LOOP
    v_idx := v_idx + 1;
    v_matric := upper(btrim(COALESCE(v_row->>'matric_number','')));
    v_course_code := upper(btrim(COALESCE(v_row->>'course_code','')));
    v_course_title := NULLIF(btrim(COALESCE(v_row->>'course_title','')), '');
    v_units := COALESCE(NULLIF(v_row->>'credit_units','')::int, 2);
    v_category := COALESCE(NULLIF(v_row->>'category',''), 'subject_major');
    v_contact := COALESCE(NULLIF(v_row->>'contact_no','')::int, 1);
    v_status_code := upper(COALESCE(NULLIF(v_row->>'status_code',''), 'OK'));

    IF v_matric = '' OR v_course_code = '' THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'matric_number and course_code are required');
      CONTINUE;
    END IF;
    IF v_status_code NOT IN ('OK','ABS','INC','WH') THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'matric_number', v_matric, 'reason', 'invalid status_code ' || v_status_code);
      CONTINUE;
    END IF;

    SELECT s.id, s.department_id, s.current_level_id
      INTO v_student_id, v_dept_id, v_level_id
    FROM public.students s WHERE upper(s.matric_number) = v_matric LIMIT 1;
    IF v_student_id IS NULL THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'matric_number', v_matric, 'reason', 'no student record with this matric number');
      CONTINUE;
    END IF;

    IF v_row ? 'ca' OR v_row ? 'exam' THEN
      v_ca := COALESCE(NULLIF(v_row->>'ca','')::numeric, 0);
      v_exam := COALESCE(NULLIF(v_row->>'exam','')::numeric, 0);
    ELSE
      v_score := COALESCE(NULLIF(v_row->>'score','')::numeric, 0);
      v_score := LEAST(GREATEST(v_score, 0), 100);
      v_exam := LEAST(v_score, 60);
      v_ca := v_score - v_exam;
    END IF;
    IF v_ca < 0 OR v_ca > 40 OR v_exam < 0 OR v_exam > 60 THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'matric_number', v_matric, 'reason', 'CA must be 0-40 and Exam 0-60');
      CONTINUE;
    END IF;

    SELECT id INTO v_semester_id FROM public.semesters
      WHERE session_id = v_session_id AND contact_number = v_contact LIMIT 1;
    IF v_semester_id IS NULL THEN
      IF _dry_run THEN
        v_semester_id := gen_random_uuid();
      ELSE
        INSERT INTO public.semesters (session_id, type, start_date, end_date, is_current, label, contact_number, registration_open)
        SELECT v_session_id,
               (CASE WHEN v_contact % 2 = 1 THEN 'first' ELSE 'second' END)::semester_type,
               a.start_date, a.end_date, false, 'Contact ' || v_contact, v_contact, false
        FROM public.academic_sessions a WHERE a.id = v_session_id
        RETURNING id INTO v_semester_id;
        v_sem_created := v_sem_created + 1;
      END IF;
    END IF;

    -- Prefer the department's own course, otherwise reuse a shared course with the
    -- same code (course codes are globally unique, e.g. GST/ENG service courses).
    SELECT id INTO v_course_id FROM public.courses
      WHERE department_id = v_dept_id AND upper(code) = v_course_code LIMIT 1;
    IF v_course_id IS NULL THEN
      SELECT id INTO v_course_id FROM public.courses
        WHERE upper(code) = v_course_code LIMIT 1;
    END IF;
    IF v_course_id IS NULL THEN
      IF _dry_run THEN
        v_course_id := gen_random_uuid();
        v_courses_created := v_courses_created + 1;
      ELSE
        INSERT INTO public.courses (department_id, code, title, credit_units, level_id, semester_type, category, is_active)
        VALUES (v_dept_id, v_course_code, COALESCE(v_course_title, v_course_code), v_units, v_level_id,
                (CASE WHEN v_contact % 2 = 1 THEN 'first' ELSE 'second' END)::semester_type, v_category, true)
        RETURNING id INTO v_course_id;
        v_courses_created := v_courses_created + 1;
      END IF;
    END IF;

    IF NOT _dry_run THEN
      SELECT id INTO v_offering_id FROM public.course_offerings
        WHERE course_id = v_course_id AND semester_id = v_semester_id LIMIT 1;
      IF v_offering_id IS NULL THEN
        INSERT INTO public.course_offerings (course_id, semester_id, max_students)
        VALUES (v_course_id, v_semester_id, 500) RETURNING id INTO v_offering_id;
        v_offerings_created := v_offerings_created + 1;
      END IF;

      SELECT id INTO v_registration_id FROM public.course_registrations
        WHERE student_id = v_student_id AND offering_id = v_offering_id LIMIT 1;
      IF v_registration_id IS NULL THEN
        INSERT INTO public.course_registrations (student_id, offering_id, status)
        VALUES (v_student_id, v_offering_id, 'approved') RETURNING id INTO v_registration_id;
        v_regs_created := v_regs_created + 1;
      END IF;

      SELECT id INTO v_result_id FROM public.results
        WHERE student_id = v_student_id AND offering_id = v_offering_id LIMIT 1;
      IF v_result_id IS NULL THEN
        INSERT INTO public.results (
          registration_id, student_id, offering_id, ca_score, exam_score,
          status, status_code, published_at, submitted_by, submitted_at,
          hod_approved_by, hod_approved_at, dean_approved_by, dean_approved_at,
          registry_approved_by, registry_approved_at
        ) VALUES (
          v_registration_id, v_student_id, v_offering_id, v_ca, v_exam,
          (CASE WHEN v_publish THEN 'published' ELSE 'draft' END)::result_status,
          v_status_code::result_status_code,
          (CASE WHEN v_publish THEN now() ELSE NULL END),
          v_actor, now(),
          (CASE WHEN v_publish THEN v_actor END), (CASE WHEN v_publish THEN now() END),
          (CASE WHEN v_publish THEN v_actor END), (CASE WHEN v_publish THEN now() END),
          (CASE WHEN v_publish THEN v_actor END), (CASE WHEN v_publish THEN now() END)
        );
        v_results_created := v_results_created + 1;
      ELSE
        UPDATE public.results
          SET ca_score = v_ca, exam_score = v_exam, status_code = v_status_code::result_status_code
          WHERE id = v_result_id;
        v_results_updated := v_results_updated + 1;
      END IF;

      v_students := array_append(v_students, v_student_id);
    ELSE
      v_results_created := v_results_created + 1;
    END IF;
  END LOOP;

  IF NOT _dry_run THEN
    FOREACH v_sid IN ARRAY (SELECT ARRAY(SELECT DISTINCT unnest(v_students))) LOOP
      PERFORM public.recompute_student_cgpa(v_sid);
    END LOOP;

    INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (v_actor, 'bulk_import', 'results', NULL,
            jsonb_build_object('session', v_session_name, 'rows', v_idx,
                               'results_created', v_results_created,
                               'results_updated', v_results_updated));
  END IF;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'session_name', v_session_name,
    'rows_read', v_idx,
    'semesters_created', v_sem_created,
    'courses_created', v_courses_created,
    'offerings_created', v_offerings_created,
    'registrations_created', v_regs_created,
    'results_created', v_results_created,
    'results_updated', v_results_updated,
    'errors', v_errors
  );
END;
$function$;