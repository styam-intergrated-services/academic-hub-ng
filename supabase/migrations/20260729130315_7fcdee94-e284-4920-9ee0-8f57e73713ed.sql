DO $$
DECLARE r record; res jsonb; total int := 0;
BEGIN
  FOR r IN SELECT key, payload FROM public.import_payloads WHERE key LIKE 'hau-2022-c%' ORDER BY key LOOP
    res := public.admin_bulk_import_results(r.payload, true);
    IF jsonb_array_length(res->'errors') > 0 THEN
      RAISE EXCEPTION 'Validation failed for %: %', r.key, (res->'errors');
    END IF;
  END LOOP;

  FOR r IN SELECT key, payload FROM public.import_payloads WHERE key LIKE 'hau-2022-c%' ORDER BY key LOOP
    res := public.admin_bulk_import_results(r.payload, false);
    total := total + COALESCE((res->>'results_created')::int, 0);
    RAISE NOTICE '% -> %', r.key, res;
  END LOOP;

  RAISE NOTICE 'Hausa import complete: % results created', total;
END $$;