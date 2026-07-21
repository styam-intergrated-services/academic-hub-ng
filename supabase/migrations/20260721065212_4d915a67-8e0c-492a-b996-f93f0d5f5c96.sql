
-- Fix 1: academic_calendar_events - respect is_public flag
DROP POLICY IF EXISTS "Everyone reads calendar" ON public.academic_calendar_events;

CREATE POLICY "Read public calendar events"
ON public.academic_calendar_events
FOR SELECT
TO authenticated
USING (
  is_public = true
  OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost','dean','hod']::app_role[])
);

-- Fix 2: profiles - scope staff read access to actual relationships
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;

CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  -- Full admin/registry access retained for administrative operations
  OR public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry','provost']::app_role[])
  -- Deans: profiles of students in their faculty's departments
  OR (
    public.has_role(auth.uid(), 'dean'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.departments d ON d.id = s.department_id
      JOIN public.departments dd ON dd.id = s.department_id
      WHERE s.id = profiles.id
        AND d.faculty_id IN (
          SELECT faculty_id FROM public.departments
          WHERE id IN (
            SELECT department_id FROM public.user_roles ur
            LEFT JOIN public.departments dep ON true
            WHERE ur.user_id = auth.uid() AND ur.role = 'dean'::app_role
          )
        )
    )
  )
  -- HODs: profiles of students / lecturers in their department
  OR (
    public.has_role(auth.uid(), 'hod'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = profiles.id
        AND s.department_id IN (
          SELECT department_id FROM public.profiles WHERE id = auth.uid()
        )
    )
  )
  -- Lecturers: profiles of students registered in their course offerings
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
