-- standing_history: explicit deny for direct writes (writes happen via SECURITY DEFINER functions)
DROP POLICY IF EXISTS "No direct insert on standing history" ON public.standing_history;
CREATE POLICY "No direct insert on standing history"
  ON public.standing_history FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "No update on standing history" ON public.standing_history;
CREATE POLICY "No update on standing history"
  ON public.standing_history FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No delete on standing history" ON public.standing_history;
CREATE POLICY "No delete on standing history"
  ON public.standing_history FOR DELETE TO authenticated, anon
  USING (false);

REVOKE INSERT, UPDATE, DELETE ON public.standing_history FROM authenticated, anon;

-- result_history: explicit immutability
DROP POLICY IF EXISTS "No update on result history" ON public.result_history;
CREATE POLICY "No update on result history"
  ON public.result_history FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No delete on result history" ON public.result_history;
CREATE POLICY "No delete on result history"
  ON public.result_history FOR DELETE TO authenticated, anon
  USING (false);

REVOKE UPDATE, DELETE ON public.result_history FROM authenticated, anon;
