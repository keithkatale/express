-- Cashless card system: NFC cards assigned to students.
--
-- A card stores nothing but its factory UID. The balance stays in
-- ledger_entries, so a lost or cloned card is revoked by flipping a row rather
-- than by chasing money that was written onto the card itself. The cheap
-- 13.56 MHz cards in circulation (MIFARE Classic) have broken crypto, so they
-- must never be treated as a store of value.

create table if not exists public.student_cards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  -- Uppercase hex of the card's UID: 4, 7 or 10 bytes in practice.
  card_uid text not null,
  -- Optional human label, e.g. "replacement after loss".
  label text,
  active boolean not null default true,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  constraint student_cards_uid_format check (card_uid ~ '^[0-9A-F]{8,32}$'),
  constraint student_cards_revoked_consistent check (
    (active and revoked_at is null) or (not active and revoked_at is not null)
  )
);

-- One live card per UID. Revoked rows stay for history, and a physical card
-- can be reissued to someone else once revoked.
create unique index if not exists student_cards_active_uid_key
  on public.student_cards (card_uid)
  where active;

create index if not exists student_cards_student_id_idx
  on public.student_cards (student_id);

alter table public.student_cards enable row level security;

create policy "student_cards staff manage"
on public.student_cards for all
to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

create policy "student_cards parent read linked"
on public.student_cards for select
to authenticated
using (public.is_parent_of_student(auth.uid(), student_id));

-- Normalise whatever the reader hands us: strip separators, uppercase.
create or replace function public.normalise_card_uid(p_uid text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_uid, ''), '[^0-9A-Fa-f]', '', 'g'));
$$;

/**
 * Assign a card to a student.
 *
 * Fails loudly when the card is already live on someone else rather than
 * silently moving it: staff should see "this card belongs to X" and decide.
 * Re-tapping a card the student already has is a no-op, so a double tap at the
 * desk does not create a duplicate.
 */
create or replace function public.assign_card_to_student(
  p_student_id uuid,
  p_card_uid text,
  p_label text default null
)
returns table (
  id uuid,
  student_id uuid,
  card_uid text,
  assigned_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_uid text := public.normalise_card_uid(p_card_uid);
  v_existing record;
  v_card_id uuid;
begin
  if v_staff_id is null or not public.is_staff(v_staff_id) then
    raise exception 'Only school staff can assign cards';
  end if;

  if v_uid !~ '^[0-9A-F]{8,32}$' then
    raise exception 'Card number % is not a valid card UID', p_card_uid;
  end if;

  if not exists (select 1 from public.students s where s.id = p_student_id) then
    raise exception 'Student not found';
  end if;

  select sc.id, sc.student_id, st.full_name
    into v_existing
  from public.student_cards sc
  join public.students st on st.id = sc.student_id
  where sc.card_uid = v_uid and sc.active;

  if found then
    if v_existing.student_id = p_student_id then
      -- Already this student's card; hand the existing row back.
      return query
      select sc.id, sc.student_id, sc.card_uid, sc.assigned_at
      from public.student_cards sc
      where sc.id = v_existing.id;
      return;
    end if;
    raise exception 'That card is already assigned to %', v_existing.full_name;
  end if;

  -- A student carries one card at a time; retire any previous one.
  update public.student_cards sc
  set active = false, revoked_at = now(), revoked_by = v_staff_id
  where sc.student_id = p_student_id and sc.active;

  insert into public.student_cards (student_id, card_uid, label, assigned_by)
  values (p_student_id, v_uid, nullif(trim(p_label), ''), v_staff_id)
  returning student_cards.id into v_card_id;

  return query
  select sc.id, sc.student_id, sc.card_uid, sc.assigned_at
  from public.student_cards sc
  where sc.id = v_card_id;
end;
$$;

revoke all on function public.assign_card_to_student(uuid, text, text) from public;
grant execute on function public.assign_card_to_student(uuid, text, text) to authenticated;

/** Retire a card without deleting its history. */
create or replace function public.revoke_student_card(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
begin
  if v_staff_id is null or not public.is_staff(v_staff_id) then
    raise exception 'Only school staff can revoke cards';
  end if;

  update public.student_cards sc
  set active = false, revoked_at = now(), revoked_by = v_staff_id
  where sc.id = p_card_id and sc.active;
end;
$$;

revoke all on function public.revoke_student_card(uuid) from public;
grant execute on function public.revoke_student_card(uuid) to authenticated;

/**
 * Look up the student holding a card.
 *
 * Returns the same shape as student_summary so a tap at the counter can show a
 * balance immediately. Empty result means the card is blank or revoked.
 */
create or replace function public.find_student_by_card(p_card_uid text)
returns table (
  id uuid,
  full_name text,
  class_name text,
  admission_no text,
  slug text,
  student_code char(6),
  active boolean,
  balance integer,
  withdrawn_today integer,
  card_id uuid,
  card_uid text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := public.normalise_card_uid(p_card_uid);
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then
    raise exception 'Only school staff can look up cards';
  end if;

  return query
  select
    ss.id, ss.full_name, ss.class_name, ss.admission_no, ss.slug,
    ss.student_code, ss.active, ss.balance, ss.withdrawn_today,
    sc.id as card_id, sc.card_uid
  from public.student_cards sc
  join public.student_summary ss on ss.id = sc.student_id
  where sc.card_uid = v_uid and sc.active;
end;
$$;

revoke all on function public.find_student_by_card(text) from public;
grant execute on function public.find_student_by_card(text) to authenticated;
