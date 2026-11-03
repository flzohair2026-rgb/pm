create or replace function public.get_bookings_register_page(
  p_filters jsonb default '{}'::jsonb,
  p_cursor jsonb default null,
  p_direction text default 'next',
  p_page_size integer default 5,
  p_include_count boolean default true
) returns jsonb
language plpgsql stable security invoker
set search_path = ''
set statement_timeout = '12s'
as $function$
declare
  v_hotel uuid;
  v_role text;
  v_status text := coalesce(p_filters->>'status', 'all');
  v_type text := coalesce(p_filters->>'type', 'all');
  v_contract text := coalesce(p_filters->>'contract', 'all');
  v_arrival date := nullif(p_filters->>'arrival', '')::date;
  v_departure date := nullif(p_filters->>'departure', '')::date;
  v_today date := (now() at time zone 'Asia/Riyadh')::date;
  v_search text := btrim(coalesce(p_filters->>'q', ''));
  v_pattern text;
  v_cursor_time timestamptz := coalesce((p_cursor->>'created_at')::timestamptz, '-infinity'::timestamptz);
  v_cursor_id uuid := (p_cursor->>'id')::uuid;
  v_limit integer := greatest(1, least(coalesce(p_page_size, 5), 50));
  v_result jsonb;
begin
  v_role := (select public.get_my_role_safe());
  if (select auth.uid()) is null or coalesce(v_role, '') not in ('admin','manager','receptionist','reception','accountant') then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  -- Resolve the same cookie/default hotel scope inside the authenticated read,
  -- avoiding separate user/profile network requests before the page query.
  if nullif(p_filters->>'hotel','all') is not null then
    v_hotel := (p_filters->>'hotel')::uuid;
  elsif v_role <> 'admin' then
    select p.default_hotel_id into v_hotel from public.profiles p where p.id=(select auth.uid());
  end if;
  if p_direction not in ('next','previous') or (p_cursor is not null and v_cursor_id is null) then
    raise exception 'Invalid cursor or direction' using errcode = '22023';
  end if;
  if length(v_search) > 200 then raise exception 'Search is too long' using errcode = '22023'; end if;
  -- Literal substring matching: punctuation never becomes PostgREST/SQL syntax.
  v_pattern := '%' || replace(replace(replace(v_search, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';

  with filtered as not materialized (
    select b.id, b.created_at
    from public.bookings b
    where (v_hotel is null or b.hotel_id = v_hotel)
      and (v_status = 'all' or (v_status = 'active' and b.check_in <= v_today and b.check_out >= v_today) or b.status = v_status)
      and (v_type = 'all' or b.booking_type = v_type)
      and (v_arrival is null or b.check_in = v_arrival)
      and (v_departure is null or b.check_out = v_departure)
      and (v_search = '' or b.customer_id in (
        select c.id from public.customers c where c.full_name ilike v_pattern or c.phone ilike v_pattern
      ) or b.unit_id in (select u.id from public.units u where u.unit_number ilike v_pattern))
      and (v_contract = 'all'
        or (v_contract = 'ejar_uploaded' and exists(select 1 from public.ejar_contract_uploads e where e.booking_id=b.id))
        or (v_contract = 'additional_services' and not exists(select 1 from public.ejar_contract_uploads e where e.booking_id=b.id)
          and exists(select 1 from public.invoices i where i.booking_id=b.id and i.status <> 'void' and i.additional_services_amount > 0))
        or (v_contract = 'none' and not exists(select 1 from public.ejar_contract_uploads e where e.booking_id=b.id)
          and not exists(select 1 from public.invoices i where i.booking_id=b.id and i.status <> 'void' and i.additional_services_amount > 0)))
  ), candidates as materialized (
    select f.* from filtered f
    where p_cursor is null
      or (p_direction='next' and (coalesce(f.created_at,'-infinity'::timestamptz),f.id) < (v_cursor_time,v_cursor_id))
      or (p_direction='previous' and (coalesce(f.created_at,'-infinity'::timestamptz),f.id) > (v_cursor_time,v_cursor_id))
    order by
      case when p_direction='next' then coalesce(f.created_at,'-infinity'::timestamptz) end desc,
      case when p_direction='next' then f.id end desc,
      case when p_direction='previous' then coalesce(f.created_at,'-infinity'::timestamptz) end asc,
      case when p_direction='previous' then f.id end asc
    limit v_limit + 1
  ), page_ids as materialized (
    select * from candidates
    order by
      case when p_direction='next' then coalesce(created_at,'-infinity'::timestamptz) end desc,
      case when p_direction='next' then id end desc,
      case when p_direction='previous' then coalesce(created_at,'-infinity'::timestamptz) end asc,
      case when p_direction='previous' then id end asc
    limit v_limit
  ), page_rows as (
    select p.id,p.created_at,jsonb_build_object(
      'booking',jsonb_build_object('id',b.id,'created_at',b.created_at,'status',b.status,'booking_type',b.booking_type,
        'check_in',b.check_in,'check_out',b.check_out,'total_price',b.total_price,
        'customer',case when c.id is null then null else jsonb_build_object('full_name',c.full_name,'phone',c.phone) end,
        'unit',case when u.id is null then null else jsonb_build_object('unit_number',u.unit_number,'unit_type',jsonb_build_object('name',ut.name)) end),
      'amount',case when inv.invoice_count > 0 then inv.total else coalesce(b.total_price,0) end,
      'hasKey',exists(select 1 from public.booking_keys k where k.booking_id=b.id),
      'hasEjarUpload',e.booking_id is not null,
      'hasAdditionalServices',coalesce(inv.has_services,false),
      'ejar',case when e.booking_id is null then null else jsonb_build_object('status',e.status,'supervisor_note',e.supervisor_note,
        'decided_at',e.decided_at,'updated_at',e.updated_at,'uploaded_at',e.uploaded_at,'created_at',e.created_at) end
    ) as row_data
    from page_ids p join public.bookings b on b.id=p.id
    left join public.customers c on c.id=b.customer_id
    left join public.units u on u.id=b.unit_id
    left join public.unit_types ut on ut.id=u.unit_type_id
    left join public.ejar_contract_uploads e on e.booking_id=b.id
    left join lateral (select count(*) as invoice_count,coalesce(sum(i.total_amount),0) as total,
      bool_or(i.additional_services_amount > 0) as has_services from public.invoices i where i.booking_id=b.id and i.status <> 'void') inv on true
  )
  select jsonb_build_object(
    'hotelId',coalesce(v_hotel::text,'all'),
    'rows',coalesce((select jsonb_agg(row_data order by coalesce(created_at,'-infinity'::timestamptz) desc,id desc) from page_rows),'[]'::jsonb),
    'totalCount',case when p_include_count then (select count(*) from filtered) else null end,
    'hasNext',case when p_direction='previous' then p_cursor is not null else (select count(*) > v_limit from candidates) end,
    'hasPrevious',case when p_direction='previous' then (select count(*) > v_limit from candidates) else p_cursor is not null end,
    'nextCursor',(select jsonb_build_object('created_at',created_at,'id',id) from page_ids order by coalesce(created_at,'-infinity'::timestamptz) asc,id asc limit 1),
    'previousCursor',(select jsonb_build_object('created_at',created_at,'id',id) from page_ids order by coalesce(created_at,'-infinity'::timestamptz) desc,id desc limit 1)
  ) into v_result;
  return v_result;
end;
$function$;
