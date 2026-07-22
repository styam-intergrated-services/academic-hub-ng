-- Fix broken profiles SELECT policy: it referenced profiles.department_id which doesn't exist,
-- causing every SELECT on profiles to fail at plan time (even for super_admin).
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;

CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost']::app_role[])
  OR (
    public.has_role(auth.uid(), 'dean'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.departments d ON d.id = s.department_id
      JOIN public.faculties f ON f.id = d.faculty_id
      WHERE s.id = profiles.id
        AND f.dean_id = auth.uid()
    )
  )
  OR (
    public.has_role(auth.uid(), 'hod'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.departments d ON d.id = s.department_id
      WHERE s.id = profiles.id
        AND d.hod_id = auth.uid()
    )
  )
  OR (
    public.has_role(auth.uid(), 'lecturer'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.course_registrations cr
      JOIN public.course_lecturers cl ON cl.offering_id = cr.offering_id
      WHERE cr.student_id = profiles.id
        AND cl.lecturer_id = auth.uid()
    )
  )
);