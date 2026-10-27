-- Ghar Pantry Phase 3 — receipt transaction function + Storage bucket.
-- Run in Supabase SQL Editor, project home-app.
-- process_receipt runs in ONE database transaction: if any insert fails,
-- the whole receipt is rolled back. It creates: receipt, receipt_items,
-- expense, inventory upserts with average cost_per_unit, inventory_events
-- (bought), products (if new), and product_aliases (raw -> clean).
-- Average cost: (old_qty * old_cost + new_qty * unit_price) / (old_qty + new_qty).
-- If old cost is null, new cost = unit_price. If old qty is 0, new cost = unit_price.
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Storage policies for the receipts bucket (owner-only for Phase 3;
-- household-shared reading is a Phase 3 polish item, not claimed here).
drop policy if exists receipts_bucket_insert on storage.objects;
create policy receipts_bucket_insert on storage.objects for insert to authenticated with check (bucket_id = 'receipts' and owner = auth.uid());
drop policy if exists receipts_bucket_select on storage.objects;
create policy receipts_bucket_select on storage.objects for select to authenticated using (bucket_id = 'receipts' and owner = auth.uid());
drop policy if exists receipts_bucket_delete on storage.objects;
create policy receipts_bucket_delete on storage.objects for delete to authenticated using (bucket_id = 'receipts' and owner = auth.uid());

create or replace function public.process_receipt(
  p_household_id uuid,
  p_store_name text,
  p_receipt_date date,
  p_total numeric,
  p_tax numeric,
  p_discount numeric,
  p_storage_path text,
  p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_receipt_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_inv_id uuid;
  v_old_qty numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_qty numeric;
  v_unit_price numeric;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a household member';
  end if;
  insert into public.receipts (household_id, store_name, receipt_date, total, tax, discount, storage_path, uploaded_by)
  values (p_household_id, p_store_name, p_receipt_date, p_total, p_tax, p_discount, p_storage_path, auth.uid())
  returning id into v_receipt_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_unit_price := (v_item->>'unit_price')::numeric;
    -- Product: find by clean name in this household, else create it.
    select id into v_product_id from public.products
    where household_id = p_household_id and lower(clean_name) = lower(v_item->>'clean_name') limit 1;
    if v_product_id is null then
      insert into public.products (household_id, clean_name, category, default_unit, created_by)
      values (p_household_id, v_item->>'clean_name', coalesce(v_item->>'category', 'Other'), coalesce(v_item->>'unit', 'pcs'), auth.uid())
      returning id into v_product_id;
    end if;
    insert into public.receipt_items (receipt_id, raw_text, clean_name, product_id, quantity, unit, unit_price, total)
    values (v_receipt_id, v_item->>'raw_text', v_item->>'clean_name', v_product_id, v_qty, coalesce(v_item->>'unit', 'pcs'), v_unit_price, coalesce((v_item->>'total')::numeric, v_qty * coalesce(v_unit_price, 0)));
    -- Alias: raw text -> clean name, for this household.
    insert into public.product_aliases (household_id, product_id, raw_text, clean_name)
    values (p_household_id, v_product_id, v_item->>'raw_text', v_item->>'clean_name')
    on conflict do nothing;
    -- Inventory upsert by name in this household, with average cost.
    select id, quantity, cost_per_unit into v_inv_id, v_old_qty, v_old_cost from public.inventory
    where household_id = p_household_id and lower(name) = lower(v_item->>'clean_name') limit 1;
    if v_inv_id is null then
      insert into public.inventory (household_id, product_id, name, category, quantity, unit, storage, cost_per_unit, added_by)
      values (p_household_id, v_product_id, v_item->>'clean_name', coalesce(v_item->>'category', 'Other'), v_qty, coalesce(v_item->>'unit', 'pcs'), 'Pantry', v_unit_price, 'receipt')
      returning id into v_inv_id;
    else
      if v_old_cost is null or v_old_qty is null or v_old_qty = 0 then
        v_new_cost := v_unit_price;
      else
        v_new_cost := (v_old_qty * v_old_cost + v_qty * coalesce(v_unit_price, 0)) / (v_old_qty + v_qty);
      end if;
      update public.inventory set quantity = v_old_qty + v_qty, cost_per_unit = v_new_cost, updated_at = now() where id = v_inv_id;
    end if;
    insert into public.inventory_events (household_id, inventory_id, event_type, quantity_change, user_id, note)
    values (p_household_id, v_inv_id, 'bought', v_qty, auth.uid(), 'Receipt ' || v_receipt_id::text);
  end loop;

  insert into public.expenses (household_id, receipt_id, amount, category, store_name, paid_by, expense_date, note)
  values (p_household_id, v_receipt_id, coalesce(p_total, 0), 'Groceries', p_store_name, auth.uid(), coalesce(p_receipt_date, current_date), 'Receipt');
  return v_receipt_id;
end;
$$;
grant execute on function public.process_receipt(uuid, text, date, numeric, numeric, numeric, text, jsonb) to authenticated;
