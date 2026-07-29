CREATE POLICY "Students read own graduation entry"
ON public.graduation_list_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = graduation_list_entries.student_id AND s.auth_user_id = auth.uid()));

CREATE POLICY "Students read graduation list of own entry"
ON public.graduation_lists FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.graduation_list_entries e
  JOIN public.students s ON s.id = e.student_id
  WHERE e.list_id = graduation_lists.id AND s.auth_user_id = auth.uid()
));