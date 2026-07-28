CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matric_number TEXT,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  user_id UUID,
  contact TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prr_status ON public.password_reset_requests(status, created_at DESC);

GRANT SELECT ON public.password_reset_requests TO authenticated;
GRANT ALL ON public.password_reset_requests TO service_role;

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and registry can view reset requests" ON public.password_reset_requests;
CREATE POLICY "Admins and registry can view reset requests"
ON public.password_reset_requests FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','ict_admin','registry']::public.app_role[]));