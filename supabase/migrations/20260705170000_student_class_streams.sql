-- Class validation + staff student registration (no parent link)

create or replace function public.validate_student_class_name(p_class text)
returns boolean
language plpgsql
immutable
as $$
declare
  level int;
  stream text;
begin
  if p_class is null or trim(p_class) = '' then
    return false;
  end if;

  if p_class !~ '^S\.[1-6] (North|East|West|South|Sciences|Arts)$' then
    return false;
  end if;

  level := substring(split_part(trim(p_class), ' ', 1) from 3)::int;
  stream := split_part(trim(p_class), ' ', 2);

  if level between 1 and 4 then
    return stream in ('North', 'East', 'West', 'South');
  end if;

  if level between 5 and 6 then
    return stream in ('Sciences', 'Arts');
  end if;

  return false;
end;
$$;

create or replace function public.register_student_for_staff(
  p_full_name text,
  p_class_name text
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
  v_name text := trim(p_full_name);
  v_class text := trim(p_class_name);
  v_code char(6);
  v_slug text;
  v_student_id uuid;
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if length(v_name) < 2 then
    raise exception 'Student name is too short';
  end if;

  if not public.validate_student_class_name(v_class) then
    raise exception 'Select a valid class and stream';
  end if;

  v_code := public.generate_unique_student_code();
  v_slug := public.generate_unique_student_slug(v_name);

  insert into public.students (full_name, class_name, admission_no, slug, student_code)
  values (v_name, v_class, v_code, v_slug, v_code)
  returning students.id into v_student_id;

  return query
  select s.id, s.full_name, s.class_name, s.admission_no, s.slug, s.student_code
  from public.students s
  where s.id = v_student_id;
end;
$$;

revoke all on function public.register_student_for_staff(text, text) from public;
grant execute on function public.register_student_for_staff(text, text) to authenticated;

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
  v_class text := trim(p_class_name);
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

  if not public.validate_student_class_name(v_class) then
    raise exception 'Select a valid class and stream';
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

drop function if exists public.search_students_for_parent(text);

create function public.search_students_for_parent(search_query text)
returns table (
  id uuid,
  full_name text,
  class_name text,
  admission_no text,
  slug text,
  student_code char(6),
  has_parent_linked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.full_name,
    s.class_name,
    s.admission_no,
    s.slug,
    s.student_code,
    exists (
      select 1 from public.parent_students ps where ps.student_id = s.id
    ) as has_parent_linked
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
