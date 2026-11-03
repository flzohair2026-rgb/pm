-- Patch the deployed definition without dropping the function or changing its grants.
-- The guards prevent applying this patch to an unexpected function version.
DO $patch$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_functiondef('public.get_dashboard_full_snapshot(text,text,text,text,text,text,text)'::regprocedure)
    INTO definition;
  IF strpos(definition, 'i.hotel_id,') = 0
     OR strpos(definition, 'v_is_all OR i.hotel_id = v_hotel_uuid') = 0
     OR strpos(definition, 'ut.daily_price, ut.price_per_year') = 0 THEN
    RAISE EXCEPTION 'Unexpected dashboard snapshot definition; inspect before patching';
  END IF;
  definition := replace(definition, 'i.hotel_id,',
    '(SELECT bk.hotel_id FROM public.bookings bk WHERE bk.id = i.booking_id) AS hotel_id,');
  definition := replace(definition, 'v_is_all OR i.hotel_id = v_hotel_uuid',
    'v_is_all OR EXISTS (SELECT 1 FROM public.bookings bk WHERE bk.id = i.booking_id AND bk.hotel_id = v_hotel_uuid)');
  definition := replace(definition, 'ut.daily_price, ut.price_per_year', 'ut.daily_price');
  EXECUTE definition;
END;
$patch$;
