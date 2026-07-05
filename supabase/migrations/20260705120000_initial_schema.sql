-- SchoolPurse schema

create type public.user_role as enum ('parent', 'secretary', 'admin');
create type public.entry_type as enum ('deposit', 'withdrawal', 'adjustment');
create type public.entry_status as enum ('pending', 'confirmed', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'parent',
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  class_name text not null,
  admission_no text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.parent_students (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  entry_type public.entry_type not null,
  amount integer not null check (amount > 0),
  status public.entry_status not null default 'pending',
  note text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ledger_entries_student_id_idx on public.ledger_entries (student_id);
create index ledger_entries_status_idx on public.ledger_entries (status);
create index ledger_entries_created_at_idx on public.ledger_entries (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ledger_entries_updated_at
before update on public.ledger_entries
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'parent')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace view public.student_balances as
select
  s.id as student_id,
  coalesce(
    sum(
      case
        when le.status = 'confirmed' and le.entry_type in ('deposit', 'adjustment') then le.amount
        when le.status = 'confirmed' and le.entry_type = 'withdrawal' then -le.amount
        else 0
      end
    ),
    0
  )::integer as balance
from public.students s
left join public.ledger_entries le on le.student_id = s.id
group by s.id;

create or replace view public.student_summary as
select
  s.id,
  s.full_name,
  s.class_name,
  s.admission_no,
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

create or replace function public.is_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role in ('secretary', 'admin')
  );
$$;

create or replace function public.is_parent_of_student(uid uuid, sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parent_students ps
    where ps.parent_id = uid and ps.student_id = sid
  );
$$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.parent_students enable row level security;
alter table public.ledger_entries enable row level security;

create policy "profiles read own"
on public.profiles for select
using (auth.uid() = id or public.is_staff(auth.uid()));

create policy "profiles update own"
on public.profiles for update
using (auth.uid() = id);

create policy "students parent read linked"
on public.students for select
using (
  public.is_staff(auth.uid())
  or public.is_parent_of_student(auth.uid(), id)
);

create policy "students staff insert"
on public.students for insert
with check (public.is_staff(auth.uid()));

create policy "students staff update"
on public.students for update
using (public.is_staff(auth.uid()));

create policy "parent_students parent read own"
on public.parent_students for select
using (parent_id = auth.uid() or public.is_staff(auth.uid()));

create policy "parent_students staff manage"
on public.parent_students for all
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

create policy "ledger parent read linked"
on public.ledger_entries for select
using (
  public.is_staff(auth.uid())
  or public.is_parent_of_student(auth.uid(), student_id)
);

create policy "ledger parent insert pending deposit"
on public.ledger_entries for insert
with check (
  created_by = auth.uid()
  and entry_type = 'deposit'
  and status = 'pending'
  and public.is_parent_of_student(auth.uid(), student_id)
);

create policy "ledger staff insert withdrawal"
on public.ledger_entries for insert
with check (
  public.is_staff(auth.uid())
  and created_by = auth.uid()
  and entry_type = 'withdrawal'
  and status = 'confirmed'
);

create policy "ledger staff update status"
on public.ledger_entries for update
using (public.is_staff(auth.uid()));

grant select on public.student_balances to authenticated;
grant select on public.student_summary to authenticated;

alter publication supabase_realtime add table public.ledger_entries;
