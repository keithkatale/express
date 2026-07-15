-- Parent invites + phone uniqueness for password-based phone/email identity

create unique index if not exists profiles_phone_unique_idx
  on public.profiles (phone)
  where phone is not null;

create table if not exists public.parent_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  student_id uuid not null references public.students (id) on delete cascade,
  email text,
  phone text,
  parent_name text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint parent_invites_contact_check check (
    email is not null or phone is not null
  )
);

create index parent_invites_student_id_idx on public.parent_invites (student_id);
create index parent_invites_token_idx on public.parent_invites (token);
create index parent_invites_phone_idx on public.parent_invites (phone)
  where phone is not null;

alter table public.parent_invites enable row level security;

create policy "parent_invites staff manage"
on public.parent_invites for all
to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- Sync phone from auth metadata on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'parent'),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;
