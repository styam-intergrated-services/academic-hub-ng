ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_code TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_staff_code_key
  ON public.profiles (staff_code) WHERE staff_code IS NOT NULL;