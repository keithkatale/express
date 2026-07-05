-- Parent self-link during onboarding + student search RPC

create policy "parent_students parent insert own"
on public.parent_students for insert
with check (parent_id = auth.uid());

create or replace function public.search_students_for_parent(search_query text)
returns table (
  id uuid,
  full_name text,
  class_name text,
  admission_no text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.full_name, s.class_name, s.admission_no
  from public.students s
  where s.active = true
    and length(trim(search_query)) >= 2
    and (
      s.full_name ilike '%' || trim(search_query) || '%'
      or s.admission_no ilike '%' || trim(search_query) || '%'
      or s.class_name ilike '%' || trim(search_query) || '%'
    )
  order by s.full_name
  limit 20;
$$;

revoke all on function public.search_students_for_parent(text) from public;
grant execute on function public.search_students_for_parent(text) to authenticated;
