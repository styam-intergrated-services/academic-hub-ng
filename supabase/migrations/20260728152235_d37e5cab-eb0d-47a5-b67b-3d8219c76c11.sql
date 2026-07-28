CREATE OR REPLACE FUNCTION public.admin_import_iss_lvt_2022(_payload jsonb, _dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id uuid; v_dept_id uuid; v_prog_id uuid; v_faculty_id uuid;
  v_actor uuid;
  v_level_by_code jsonb := '{}'::jsonb;
  v_level_id uuid;
  v_semester_by_contact jsonb := '{}'::jsonb;
  v_course_by_code jsonb := '{}'::jsonb;
  v_offering_by_key jsonb := '{}'::jsonb;
  r_course record;
  r_stu jsonb;
  r_res record;
  v_contact int;
  v_course_code text;
  v_credit_units int;
  v_category text;
  v_semester_id uuid;
  v_course_id uuid;
  v_offering_id uuid;
  v_student_id uuid;
  v_registration_id uuid;
  v_total_semesters int := 0;
  v_total_courses int := 0;
  v_total_offerings int := 0;
  v_total_students_new int := 0;
  v_total_students_existing int := 0;
  v_total_registrations int := 0;
  v_total_results int := 0;
  v_max_contact int;
  v_current_level_id uuid;
  v_student_ids uuid[] := ARRAY[]::uuid[];
  v_stu_id uuid;
  v_matric text;
  v_results jsonb;
  v_score numeric;
  v_ca numeric;
  v_exam numeric;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin'::app_role) OR current_user = 'postgres') THEN
    RAISE EXCEPTION 'Only super_admin may run this importer';
  END IF;

  v_actor := COALESCE(auth.uid(), (SELECT user_id FROM public.user_roles WHERE role = 'super_admin'::app_role ORDER BY created_at LIMIT 1));

  PERFORM set_config('app.import_mode', 'true', true);

  SELECT id, faculty_id INTO v_dept_id, v_faculty_id
    FROM public.departments WHERE name = 'Islamic Studies' LIMIT 1;
  IF v_dept_id IS NULL THEN RAISE EXCEPTION 'Islamic Studies department not found'; END IF;

  SELECT id INTO v_prog_id FROM public.programmes WHERE code = 'BA-ISL-LVT' LIMIT 1;
  IF v_prog_id IS NULL THEN RAISE EXCEPTION 'Programme BA-ISL-LVT not found'; END IF;

  FOR r_course IN SELECT id, code FROM public.levels WHERE code LIKE 'L%' LOOP
    v_level_by_code := v_level_by_code || jsonb_build_object(r_course.code, r_course.id::text);
  END LOOP;

  SELECT id INTO v_session_id FROM public.academic_sessions WHERE name = '2022/2023 Academic Session' LIMIT 1;
  IF v_session_id IS NULL THEN
    IF _dry_run THEN
      v_session_id := gen_random_uuid();
    ELSE
      INSERT INTO public.academic_sessions (name, start_date, end_date, status)
      VALUES ('2022/2023 Academic Session', '2022-09-01', '2023-08-31', 'archived')
      RETURNING id INTO v_session_id;
    END IF;
  END IF;

  FOR r_course IN SELECT * FROM jsonb_to_recordset(_payload->'contacts') AS x(contact_no int, level_code text) LOOP
    v_contact := r_course.contact_no;
    SELECT id INTO v_semester_id FROM public.semesters
      WHERE session_id = v_session_id AND contact_number = v_contact LIMIT 1;
    IF v_semester_id IS NULL THEN
      IF _dry_run THEN
        v_semester_id := gen_random_uuid();
      ELSE
        INSERT INTO public.semesters (session_id, type, start_date, end_date, is_current,
                                      label, contact_number, registration_open)
        VALUES (v_session_id,
                (CASE WHEN v_contact % 2 = 1 THEN 'first' ELSE 'second' END)::semester_type,
                '2022-09-01', '2023-08-31', false,
                'Contact ' || v_contact, v_contact, false)
        RETURNING id INTO v_semester_id;
      END IF;
      v_total_semesters := v_total_semesters + 1;
    END IF;
    v_semester_by_contact := v_semester_by_contact || jsonb_build_object(v_contact::text, v_semester_id::text);
  END LOOP;

  FOR r_course IN SELECT * FROM jsonb_to_recordset(_payload->'courses')
    AS x(code text, credit_units int, category text, contacts int[]) LOOP
    v_course_code := r_course.code;
    v_credit_units := COALESCE(r_course.credit_units, 2);
    v_category := COALESCE(r_course.category, 'subject_major');
    v_level_id := ((v_level_by_code ->> ('L' || (LEAST(r_course.contacts[1]) * 100)::text))::uuid);
    IF v_level_id IS NULL THEN
      v_level_id := (v_level_by_code ->> 'L200')::uuid;
    END IF;

    SELECT id INTO v_course_id FROM public.courses
      WHERE department_id = v_dept_id AND code = v_course_code LIMIT 1;
    IF v_course_id IS NULL THEN
      IF _dry_run THEN
        v_course_id := gen_random_uuid();
      ELSE
        INSERT INTO public.courses (department_id, code, title, credit_units, level_id,
                                    semester_type, category, is_active)
        VALUES (v_dept_id, v_course_code, v_course_code, v_credit_units, v_level_id,
                'first'::semester_type, v_category, true)
        RETURNING id INTO v_course_id;
      END IF;
      v_total_courses := v_total_courses + 1;
    END IF;
    v_course_by_code := v_course_by_code || jsonb_build_object(v_course_code, v_course_id::text);

    FOR v_contact IN SELECT unnest FROM unnest(r_course.contacts) LOOP
      v_semester_id := (v_semester_by_contact ->> v_contact::text)::uuid;
      IF v_semester_id IS NULL THEN CONTINUE; END IF;
      SELECT id INTO v_offering_id FROM public.course_offerings
        WHERE course_id = v_course_id AND semester_id = v_semester_id LIMIT 1;
      IF v_offering_id IS NULL THEN
        IF _dry_run THEN
          v_offering_id := gen_random_uuid();
        ELSE
          INSERT INTO public.course_offerings (course_id, semester_id, max_students)
          VALUES (v_course_id, v_semester_id, 200)
          RETURNING id INTO v_offering_id;
        END IF;
        v_total_offerings := v_total_offerings + 1;
      END IF;
      v_offering_by_key := v_offering_by_key ||
        jsonb_build_object(v_course_code || '@' || v_contact::text, v_offering_id::text);
    END LOOP;
  END LOOP;

  FOR r_stu IN SELECT value FROM jsonb_array_elements(_payload->'students') LOOP
    v_matric := (r_stu ->> 'matric_number');
    v_results := (r_stu -> 'results');

    SELECT id INTO v_student_id FROM public.students WHERE matric_number = v_matric LIMIT 1;

    SELECT MAX((v->>'contact_no')::int) INTO v_max_contact
      FROM jsonb_array_elements(v_results) v;
    v_current_level_id := (v_level_by_code ->> ('L' || (v_max_contact * 100)::text))::uuid;
    IF v_current_level_id IS NULL THEN
      v_current_level_id := (v_level_by_code ->> 'L400')::uuid;
    END IF;

    IF v_student_id IS NULL THEN
      IF _dry_run THEN
        v_student_id := gen_random_uuid();
      ELSE
        INSERT INTO public.students (matric_number, programme_id, department_id,
                                     current_level_id, entry_session_id, entry_year,
                                     default_password_changed)
        VALUES (v_matric, v_prog_id, v_dept_id, v_current_level_id,
                v_session_id, 2022, false)
        RETURNING id INTO v_student_id;
      END IF;
      v_total_students_new := v_total_students_new + 1;
    ELSE
      v_total_students_existing := v_total_students_existing + 1;
    END IF;
    v_student_ids := array_append(v_student_ids, v_student_id);

    FOR r_res IN SELECT * FROM jsonb_to_recordset(v_results)
      AS x(contact_no int, course_code text, score int, grade text, credit_units int, status_code text) LOOP
      v_offering_id := (v_offering_by_key ->> (r_res.course_code || '@' || r_res.contact_no::text))::uuid;
      IF v_offering_id IS NULL THEN CONTINUE; END IF;

      SELECT id INTO v_registration_id FROM public.course_registrations
        WHERE student_id = v_student_id AND offering_id = v_offering_id LIMIT 1;
      IF v_registration_id IS NULL THEN
        IF _dry_run THEN
          v_registration_id := gen_random_uuid();
        ELSE
          INSERT INTO public.course_registrations (student_id, offering_id, status)
          VALUES (v_student_id, v_offering_id, 'approved')
          RETURNING id INTO v_registration_id;
        END IF;
        v_total_registrations := v_total_registrations + 1;
      END IF;

      IF NOT _dry_run THEN
        v_score := COALESCE(r_res.score, 0);
        IF v_score < 0 THEN v_score := 0; END IF;
        IF v_score > 100 THEN v_score := 100; END IF;
        v_exam := LEAST(v_score, 60);
        v_ca := v_score - v_exam;
        INSERT INTO public.results (
          registration_id, student_id, offering_id,
          ca_score, exam_score,
          status, status_code, published_at,
          submitted_by, submitted_at,
          hod_approved_by, hod_approved_at,
          dean_approved_by, dean_approved_at,
          registry_approved_by, registry_approved_at
        ) VALUES (
          v_registration_id, v_student_id, v_offering_id,
          v_ca, v_exam,
          'published'::result_status,
          COALESCE(r_res.status_code, 'OK')::result_status_code,
          now(),
          v_actor, now(),
          v_actor, now(),
          v_actor, now(),
          v_actor, now()
        )
        ON CONFLICT DO NOTHING;
      END IF;
      v_total_results := v_total_results + 1;
    END LOOP;
  END LOOP;

  IF NOT _dry_run THEN
    FOREACH v_stu_id IN ARRAY v_student_ids LOOP
      PERFORM public.recompute_student_cgpa(v_stu_id);
    END LOOP;

    INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (v_actor, 'import', 'results', NULL,
            jsonb_build_object('source','ISS-LVT-2022-2023-DE',
                               'students_new', v_total_students_new,
                               'students_existing', v_total_students_existing,
                               'results', v_total_results));
  END IF;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'session_id', v_session_id,
    'semesters_created', v_total_semesters,
    'courses_created', v_total_courses,
    'offerings_created', v_total_offerings,
    'students_new', v_total_students_new,
    'students_existing', v_total_students_existing,
    'registrations_created', v_total_registrations,
    'results_upserted', v_total_results
  );
END;
$function$;

DO $$
DECLARE v_dry jsonb; v_live jsonb;
BEGIN
  SELECT public.admin_import_iss_lvt_2022(payload, true) INTO v_dry FROM public.import_payloads WHERE key = 'iss-lvt-2022';
  RAISE NOTICE 'dry run: %', v_dry;
  SELECT public.admin_import_iss_lvt_2022(payload, false) INTO v_live FROM public.import_payloads WHERE key = 'iss-lvt-2022';
  RAISE NOTICE 'live run: %', v_live;
END $$;