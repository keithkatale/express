-- Card-based withdrawal function

create or replace function public.withdraw_via_card(
  p_card_uid text,
  p_amount integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_current_balance integer;
  v_staff_id uuid;
  v_entry_id uuid;
begin
  -- Verify caller is staff
  if not public.is_staff(auth.uid()) then
    return jsonb_build_object(
      'success', false,
      'error', 'Only staff can process withdrawals'
    );
  end if;

  v_staff_id := auth.uid();

  -- Normalize the card UID
  p_card_uid := public.normalise_card_uid(p_card_uid);

  -- Find the student by card
  select sc.student_id into v_student_id
  from public.student_cards sc
  where sc.card_uid = p_card_uid
    and sc.active = true
  limit 1;

  if v_student_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Card is not assigned to any student'
    );
  end if;

  -- Check current balance
  select coalesce(sb.balance, 0) into v_current_balance
  from public.student_balances sb
  where sb.student_id = v_student_id;

  if v_current_balance < p_amount then
    return jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'available', v_current_balance,
      'requested', p_amount
    );
  end if;

  -- Create the withdrawal entry
  insert into public.ledger_entries (
    student_id,
    entry_type,
    amount,
    status,
    note,
    created_by
  )
  values (
    v_student_id,
    'withdrawal',
    p_amount,
    'confirmed',
    p_note,
    v_staff_id
  )
  returning id into v_entry_id;

  -- Return success with student info
  return jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'student_id', v_student_id,
    'amount', p_amount,
    'previous_balance', v_current_balance,
    'new_balance', v_current_balance - p_amount
  );
end;
$$;

grant execute on function public.withdraw_via_card to authenticated;
