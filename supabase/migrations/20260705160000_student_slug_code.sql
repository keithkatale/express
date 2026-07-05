-- Student slug + six-digit ID + parent registration

alter table public.students
  add column if not exists slug text,
  add column if not exists student_code char(6);

create or replace function public.slugify_student_name(name_input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(name_input)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.generate_unique_student_code()
returns char(6)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate char(6);
  attempts int := 0;
begin
  loop
    candidate := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from public.students s where s.student_code = candidate);
    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'Could not generate unique student code';
    end if;
  end loop;
  return candidate;
end;
$$;

create or replace function public.generate_unique_student_slug(base_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text := public.slugify_student_name(base_name);
  candidate text := base_slug;
  suffix int := 2;
begin
  if base_slug = '' or base_slug is null then
    base_slug := 'student';
    candidate := base_slug;
  end if;
  while exists (select 1 from public.students s where s.slug = candidate) loop
    candidate := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;
  return candidate;
end;
$$;

drop function if exists public.search_students_for_parent(text);

create or replace function public.register_student_for_parent(
  p_full_name text,
  p_class_name text default 'Unassigned'
)
returns table (
  id uuid,
  full_name text,
  class_name text,
  admission_no text,
  slug text,
  student_code char(6)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_id uuid := auth.uid();
  v_name text := trim(p_full_name);
  v_class text := coalesce(nullif(trim(p_class_name), ''), 'Unassigned');
  v_code char(6);
  v_slug text;
  v_student_id uuid;
begin
  if v_parent_id is null then
    raise exception 'Not authenticated';
  end if;
  if length(v_name) < 2 then
    raise exception 'Student name is too short';
  end if;

  v_code := public.generate_unique_student_code();
  v_slug := public.generate_unique_student_slug(v_name);

  insert into public.students (full_name, class_name, admission_no, slug, student_code)
  values (v_name, v_class, v_code, v_slug, v_code)
  returning students.id into v_student_id;

  insert into public.parent_students (parent_id, student_id)
  values (v_parent_id, v_student_id)
  on conflict do nothing;

  return query
  select s.id, s.full_name, s.class_name, s.admission_no, s.slug, s.student_code
  from public.students s
  where s.id = v_student_id;
end;
$$;

revoke all on function public.register_student_for_parent(text, text) from public;
grant execute on function public.register_student_for_parent(text, text) to authenticated;

create or replace function public.search_students_for_parent(search_query text)
returns table (
  id uuid,
  full_name text,
  class_name text,
  admission_no text,
  slug text,
  student_code char(6)
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.full_name, s.class_name, s.admission_no, s.slug, s.student_code
  from public.students s
  where s.active = true
    and length(trim(search_query)) >= 2
    and (
      s.full_name ilike '%' || trim(search_query) || '%'
      or s.admission_no ilike '%' || trim(search_query) || '%'
      or s.student_code ilike '%' || trim(search_query) || '%'
      or s.slug ilike '%' || trim(search_query) || '%'
      or s.class_name ilike '%' || trim(search_query) || '%'
    )
  order by s.full_name
  limit 20;
$$;

grant execute on function public.search_students_for_parent(text) to authenticated;

-- Backfill existing students
update public.students s
set
  student_code = coalesce(s.student_code, public.generate_unique_student_code()),
  slug = coalesce(s.slug, public.generate_unique_student_slug(s.full_name))
where s.student_code is null or s.slug is null;

alter table public.students
  alter column slug set not null,
  alter column student_code set not null;

create unique index if not exists students_slug_key on public.students (slug);
create unique index if not exists students_student_code_key on public.students (student_code);

drop view if exists public.student_summary;

create or replace view public.student_summary as
select
  s.id,
  s.full_name,
  s.class_name,
  s.admission_no,
  s.slug,
  s.student_code,
  s.active,
  coalesce(sb.balance, 0) as balance,
  coalesce(
    (
      select sum(le.amount)
      from public.ledger_entries le
      where le.student_id = s.id
        and le.entry_type = 'withdrawal'
        and le.status = 'confirmed'
        and le.created_at::date = current_date
    ),
    0
  )::integer as withdrawn_today
from public.students s
left join public.student_balances sb on sb.student_id = s.id;

grant select on public.student_summary to authenticated;
