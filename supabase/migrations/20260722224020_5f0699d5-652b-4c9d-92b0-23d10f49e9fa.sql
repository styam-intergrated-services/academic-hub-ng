
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
  v_reg_count INT;
  v_published_count INT;
  v_semester_complete BOOLEAN;
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

  -- Determine whether the whole semester is finished for this student:
  -- every approved course registration in this semester must have a published result.
  SELECT COUNT(*) INTO v_reg_count
  FROM public.course_registrations cr
  JOIN public.course_offerings o ON o.id = cr.offering_id
  WHERE cr.student_id = _student_id
    AND o.semester_id = _semester_id
    AND cr.status = 'approved';

  SELECT COUNT(*) INTO v_published_count
  FROM public.course_registrations cr
  JOIN public.course_offerings o ON o.id = cr.offering_id
  JOIN public.results r ON r.registration_id = cr.id
  WHERE cr.student_id = _student_id
    AND o.semester_id = _semester_id
    AND cr.status = 'approved'
    AND r.status = 'published';

  v_semester_complete := (v_reg_count > 0 AND v_published_count >= v_reg_count);

  -- Always upsert the semester GPA record so partial results are visible.
  INSERT INTO public.gpa_records(student_id, semester_id, gpa, cgpa, credit_units, grade_points, standing, computed_at)
  VALUES (_student_id, _semester_id, v_gpa, COALESCE(v_cgpa,0), v_units, v_points,
          COALESCE(v_cur_std, 'good'::public.academic_standing), now())
  ON CONFLICT (student_id, semester_id)
  DO UPDATE SET gpa=EXCLUDED.gpa, cgpa=EXCLUDED.cgpa, credit_units=EXCLUDED.credit_units,
                grade_points=EXCLUDED.grade_points, computed_at=now();

  -- Only re-evaluate academic standing (and notify) once the semester is fully published.
  IF NOT v_semester_complete THEN
    RETURN;
  END IF;

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
    IF v_prev_std = 'probation' THEN
      v_new_std := 'withdrawn';
      v_reason := 'CGPA remains below 1.00 after probation semester; withdrawn.';
    ELSE
      v_new_std := 'probation';
      v_reason := 'CGPA ' || COALESCE(v_cgpa,0) || ' below 1.00; placed on probation.';
    END IF;
  END IF;

  UPDATE public.gpa_records SET standing = v_new_std
    WHERE student_id = _student_id AND semester_id = _semester_id;

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
