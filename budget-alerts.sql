-- Ghar Pantry Phase 4 — budget alerts trigger + Phase 3 alias polish.
-- Run in Supabase SQL Editor, project home-app.
-- 1) Alias duplicate fix: identical (household, raw, product) rows are now
--    blocked, so process_receipt's "on conflict do nothing" actually skips
--    a repeat save instead of duplicating the alias row.
create unique index if not exists idx_alias_unique on public.product_aliases (household_id, lower(raw_text), product_id);

-- 2) Budget alerts, checked automatically on every expense insert.
--    Inserts an in-app notification (notifications table) when a weekly or
--    monthly budget crosses 50%, 80%, or 100%, and a pace warning when
--    70%+ is spent by Wednesday. One notification per threshold per period
--    (deduped by type + period start in the message check below).
--    Email alerts are NOT sent by this trigger: no email service/key is
--    configured yet, so alerts are in-app only for Phase 4, stated honestly.
create or replace function public.check_budget_alerts() returns trigger language plpgsql security definer set search_path = public as $$
declare
  b record; v_total numeric; v_pct numeric; v_start date; v_end date; v_type text; v_msg text;
begin
  for b in select * from public.budgets where household_id = new.household_id loop
    if b.period = 'weekly' then
      v_start := (new.expense_date - ((extract(dow from new.expense_date)::int + 6) % 7))::date;
      v_end := v_start + 6;
    else
      v_start := date_trunc('month', new.expense_date)::date;
      v_end := (date_trunc('month', new.expense_date) + interval '1 month - 1 day')::date;
    end if;
    select coalesce(sum(amount), 0) into v_total from public.expenses
    where household_id = new.household_id and expense_date between v_start and v_end
      and (b.category is null or category = b.category);
    if b.limit_amount > 0 then v_pct := v_total / b.limit_amount; else v_pct := 0; end if;
    v_type := null;
    if v_pct >= 1 then v_type := 'budget_100';
    elsif v_pct >= 0.8 then v_type := 'budget_80';
    elsif v_pct >= 0.5 then v_type := 'budget_50';
    end if;
    if v_type is not null then
      v_msg := v_type || ' ' || b.period || ' ' || coalesce(b.category, 'overall') || ' from ' || v_start::text;
      if not exists (select 1 from public.notifications where household_id = new.household_id and type = v_type and message = v_msg) then
        insert into public.notifications (household_id, type, message) values (new.household_id, v_type, v_msg);
      end if;
    end if;
    -- Pace warning: 70%+ spent by Wednesday (dow 3) of a weekly period.
    if b.period = 'weekly' and extract(dow from new.expense_date)::int = 3 and v_pct >= 0.7 then
      v_msg := 'budget_pace weekly ' || coalesce(b.category, 'overall') || ' from ' || v_start::text;
      if not exists (select 1 from public.notifications where household_id = new.household_id and type = 'budget_pace' and message = v_msg) then
        insert into public.notifications (household_id, type, message) values (new.household_id, 'budget_pace', v_msg);
      end if;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_budget_alerts on public.expenses;
create trigger trg_budget_alerts after insert on public.expenses for each row execute function public.check_budget_alerts();
