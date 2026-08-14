-- DGateway checkout records + ledger idempotency for mobile-money deposits

alter table public.ledger_entries
  add column if not exists reference_type text,
  add column if not exists reference_id text;

create unique index if not exists idx_ledger_dgateway_idempotency
  on public.ledger_entries (reference_type, reference_id)
  where reference_id is not null
    and reference_type = 'dgateway_deposit';

create table if not exists public.dgateway_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  mode text not null check (mode in ('demo', 'live')),
  reference text not null,
  provider text,
  provider_ref text,
  amount integer not null check (amount > 0),
  currency text not null check (currency in ('UGX', 'KES', 'TZS', 'RWF')),
  phone_number text not null,
  description text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  ledger_entry_id uuid references public.ledger_entries (id) on delete set null,
  webhook_processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dgateway_checkouts_reference_key unique (reference)
);

create index if not exists dgateway_checkouts_user_created_idx
  on public.dgateway_checkouts (user_id, created_at desc);

create index if not exists dgateway_checkouts_student_idx
  on public.dgateway_checkouts (student_id);

alter table public.dgateway_checkouts enable row level security;

drop policy if exists "dgateway_checkouts_select_own" on public.dgateway_checkouts;
create policy "dgateway_checkouts_select_own"
  on public.dgateway_checkouts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dgateway_checkouts_service_role" on public.dgateway_checkouts;
create policy "dgateway_checkouts_service_role"
  on public.dgateway_checkouts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
