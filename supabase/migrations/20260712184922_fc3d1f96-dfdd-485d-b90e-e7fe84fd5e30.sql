
DO $$
DECLARE fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.has_role(uuid, public.app_role)',
    'public.has_any_role(uuid, public.app_role[])',
    'public.current_user_roles()',
    'public.update_updated_at_column()',
    'public.handle_new_user()',
    'public.compute_grade(numeric)',
    'public.fill_result_grade()',
    'public.log_result_change()',
    'public.recompute_student_cgpa(uuid)',
    'public.recompute_semester_gpa(uuid, uuid)',
    'public.on_result_published()',
    'public.validate_registration()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;
