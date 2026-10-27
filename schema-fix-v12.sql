-- Ghar Pantry — invite-code join fix (v12, Phase 1).
-- Problem: a non-member cannot read a household to join it, because
-- households_select only allows the creator or existing members.
-- Fix: a SECURITY DEFINER function that returns ONLY the household
-- whose invite code matches exactly. It does not list households,
-- and it returns no data for a wrong code. The app must call this
-- function for join, instead of selecting from households directly.
create or replace function public.get_household_by_code(p_code text)
returns table (id uuid, name text, invite_code text)
language sql stable security definer set search_path = public as $$
  select h.id, h.name, h.invite_code from public.households h
  where h.invite_code = upper(p_code);
$$;
grant execute on function public.get_household_by_code(text) to authenticated;
