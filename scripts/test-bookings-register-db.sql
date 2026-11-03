-- Read-only integration checks. Emits only booleans/counts, never guest records.
begin read only;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='admin' limit 1),'role','authenticated')::text,true);
set local role authenticated;
with recursive pages as (
  select 1 n, public.get_bookings_register_page('{}',null,'next',50,true) data
  union all
  select n+1,public.get_bookings_register_page('{}',data->'nextCursor','next',50,false)
  from pages where (data->>'hasNext')::boolean and n < 100
), all_rows as (
  select r from pages cross join lateral jsonb_array_elements(data->'rows') r
), first_page as (
  select public.get_bookings_register_page('{}',null,'next',5,true) p1
), second_page as (
  select p1,public.get_bookings_register_page('{}',p1->'nextCursor','next',5,false) p2 from first_page
), filters as (
  select s,t,c from unnest(array['all','confirmed','checked_in','checked_out','pending_deposit','cancelled','active']) s
  cross join unnest(array['all','daily','monthly','yearly']) t
  cross join unnest(array['all','ejar_uploaded','additional_services','none']) c
), filter_checks as (
  select (public.get_bookings_register_page(jsonb_build_object('status',s,'type',t,'contract',c),null,'next',5,true)->>'totalCount')::int actual,
    (select count(*) from public.bookings b
      where (s='all' or (s='active' and b.check_in <= (now() at time zone 'Asia/Riyadh')::date and b.check_out >= (now() at time zone 'Asia/Riyadh')::date) or b.status=s)
        and (t='all' or b.booking_type=t)
        and (c='all'
          or (c='ejar_uploaded' and exists(select 1 from public.ejar_contract_uploads e where e.booking_id=b.id))
          or (c='additional_services' and not exists(select 1 from public.ejar_contract_uploads e where e.booking_id=b.id)
            and exists(select 1 from public.invoices i where i.booking_id=b.id and i.status <> 'void' and i.additional_services_amount>0))
          or (c='none' and not exists(select 1 from public.ejar_contract_uploads e where e.booking_id=b.id)
            and not exists(select 1 from public.invoices i where i.booking_id=b.id and i.status <> 'void' and i.additional_services_amount>0)))
    ) expected from filters
), search_checks as (
  select (public.get_bookings_register_page(jsonb_build_object('q',q),null,'next',5,true)->>'totalCount')::int actual,
    (select count(*) from public.bookings b
      where q='' or exists(select 1 from public.customers c where c.id=b.customer_id and (position(lower(q) in lower(c.full_name))>0 or position(lower(q) in lower(c.phone))>0))
      or exists(select 1 from public.units u where u.id=b.unit_id and position(lower(q) in lower(u.unit_number))>0)
    ) expected
  from unnest(array['','ا','1','050','%,_','a(b),c']) q
)
select jsonb_build_object(
  'all_records_returned',(select count(*) from all_rows)=(select count(*) from public.bookings),
  'no_duplicates',(select count(*) from all_rows)=(select count(distinct r->'booking'->>'id') from all_rows),
  'amounts_match',not exists(select 1 from all_rows join public.bookings b on b.id=(r->'booking'->>'id')::uuid
    where (r->>'amount')::numeric <> case when exists(select 1 from public.invoices i where i.booking_id=b.id and i.status<>'void')
      then coalesce((select sum(i.total_amount) from public.invoices i where i.booking_id=b.id and i.status <> 'void'),0) else coalesce(b.total_price,0) end),
  'previous_returns_first',(select (public.get_bookings_register_page('{}',p2->'previousCursor','previous',5,false)->'rows')=p1->'rows' from second_page),
  'filter_cases',(select count(*) from filter_checks),
  'filter_mismatches',(select count(*) from filter_checks where actual<>expected),
  'search_cases',(select count(*) from search_checks),
  'search_mismatches',(select count(*) from search_checks where actual<>expected),
  'anon_execute_denied',not has_function_privilege('anon','public.get_bookings_register_page(jsonb,jsonb,text,integer,boolean)','execute')
);
rollback;
