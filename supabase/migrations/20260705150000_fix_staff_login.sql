-- Restore function grants required by RLS policies
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.is_parent_of_student(uuid, uuid) to authenticated;
grant execute on function public.search_students_for_parent(text) to authenticated;

drop policy if exists "profiles update own" on public.profiles;

create policy "profiles update own"
on public.profiles for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and (
    role = (select p.role from public.profiles p where p.id = auth.uid())
    or public.is_staff(auth.uid())
  )
);
