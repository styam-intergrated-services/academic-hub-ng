
DROP POLICY IF EXISTS "Author or senate updates announcements" ON public.announcements;
CREATE POLICY "Author or senate updates announcements" ON public.announcements FOR UPDATE TO authenticated
  USING (author_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','provost','registry']::public.app_role[]))
  WITH CHECK (author_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','provost','registry']::public.app_role[]));

DROP POLICY IF EXISTS "Senate updates graduation lists" ON public.graduation_lists;
CREATE POLICY "Senate updates graduation lists" ON public.graduation_lists FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost']::public.app_role[]));

DROP POLICY IF EXISTS "Author or senate updates policies" ON public.policy_documents;
CREATE POLICY "Author or senate updates policies" ON public.policy_documents FOR UPDATE TO authenticated
  USING (author_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','provost','registry']::public.app_role[]))
  WITH CHECK (author_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','provost','registry']::public.app_role[]));
