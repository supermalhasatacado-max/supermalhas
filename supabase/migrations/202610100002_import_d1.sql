-- One atomic import from the existing Site database. The source remains intact.
CREATE OR REPLACE FUNCTION public.sm_import_d1_v1(snapshot jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = supermalhas, pg_catalog
SET lock_timeout = '5s'
AS $function$
DECLARE
  target text; rows jsonb; counts jsonb := '{}'::jsonb; imported integer;
  tables text[] := ARRAY['products','coupons','orders','order_events','profiles','contacts','newsletter','rate_limits','settings'];
BEGIN
  IF jsonb_typeof(snapshot) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid import snapshot'; END IF;
  PERFORM pg_advisory_xact_lock(1936747372,1);
  IF EXISTS (SELECT 1 FROM supermalhas.settings WHERE key='store') THEN RETURN jsonb_build_object('already_initialized',true); END IF;
  FOREACH target IN ARRAY tables LOOP
    rows := snapshot->target;
    IF jsonb_typeof(rows) IS DISTINCT FROM 'array' OR jsonb_array_length(rows)>10000 THEN RAISE EXCEPTION 'Invalid import table'; END IF;
    EXECUTE format('INSERT INTO supermalhas.%I SELECT * FROM jsonb_populate_recordset(NULL::supermalhas.%I,$1)',target,target) USING rows;
    GET DIAGNOSTICS imported=ROW_COUNT;
    counts := counts || jsonb_build_object(target,imported);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM supermalhas.settings WHERE key='store') THEN RAISE EXCEPTION 'Store settings missing from import'; END IF;
  INSERT INTO supermalhas.settings(key,data) VALUES ('migration:d1',jsonb_build_object('importedAt',clock_timestamp(),'counts',counts));
  RETURN jsonb_build_object('imported',true,'counts',counts);
END;
$function$;
REVOKE ALL ON FUNCTION public.sm_import_d1_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sm_import_d1_v1(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
