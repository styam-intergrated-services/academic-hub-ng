-- 1) result_history: require staff role on insert
DROP POLICY IF EXISTS "Insert result history" ON public.result_history;
CREATE POLICY "Staff insert result history"
ON public.result_history FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND public.has_any_role(auth.uid(), ARRAY['lecturer','hod','dean','registry','super_admin','ict_admin','examination_officer','provost']::public.app_role[])
);

-- 2) bulk_import_results: lock down + fixed search_path + role check
CREATE OR REPLACE FUNCTION public.bulk_import_results(p_data jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item jsonb;
  v_reg_id uuid;
  v_count int := 0;
begin
  if not (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]) or current_user = 'postgres') then
    raise exception 'Not authorized to bulk import results';
  end if;

  for v_item in select * from jsonb_array_elements(p_data)
  loop
    insert into public.course_registrations (student_id, offering_id, status)
    values ((v_item->>'sid')::uuid, (v_item->>'oid')::uuid, 'approved')
    on conflict do nothing
    returning id into v_reg_id;

    if v_reg_id is not null then
      insert into public.results (registration_id, student_id, offering_id, ca_score, exam_score, status, submitted_by, submitted_at)
      values (
        v_reg_id,
        (v_item->>'sid')::uuid,
        (v_item->>'oid')::uuid,
        (v_item->>'ca')::numeric,
        (v_item->>'exam')::numeric,
        'submitted',
        auth.uid(),
        now()
      );
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$function$;

REVOKE ALL ON FUNCTION public.bulk_import_results(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_import_results(jsonb) TO service_role;

-- 3) trigger helper should not be directly callable by clients
REVOKE ALL ON FUNCTION public.on_result_published_after() FROM PUBLIC, anon, authenticated;
