-- Home App — Phase 1 schema (Supabase, free tier)
-- Run this in Supabase: SQL Editor > New query > paste > Run.
-- Then in Authentication > Settings, turn OFF "Confirm email",
-- because login uses phone + password (see README), not a real email.

-- Profiles: one row per family member, linked to Supabase Auth.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  display_name text,
  created_at timestamptz default now()
);

-- Pantry: one row per stocked item. quantity is the TOTAL on hand.
-- Each purchase that created that stock is kept in purchase_lots,
-- so the same item (e.g. tomatoes) can have different prices per lot.
create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Other',
  quantity numeric not null default 0,
  unit text not null default 'pcs',
  storage text not null default 'Pantry',
  -- For spices, oil, salt: 'full' | 'half' | 'low' | 'empty'. Null for normal items.
  level text check (level is null or level in ('full','half','low','empty')),
  expiry_date date,
  purchase_date date,
  last_used_at timestamptz,
  added_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Purchase lots: price history. Budget totals sum lots; meal cost
-- in Phase 2 will deduct oldest lots first (FIFO).
create table if not exists public.purchase_lots (
  id uuid primary key default gen_random_uuid(),
  pantry_item_id uuid references public.pantry_items(id) on delete cascade,
  item_name text not null,
  quantity numeric not null default 0,
  unit text not null default 'pcs',
  unit_price numeric,
  total_price numeric,
  purchase_date date,
  store text,
  added_by text,
  paid_by text,
  created_at timestamptz default now()
);

-- Shared shopping list: live for everyone in the household.
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity numeric not null default 1,
  unit text not null default 'pcs',
  category text not null default 'Other',
  note text,
  checked boolean not null default false,
  added_by text,
  created_at timestamptz default now()
);

-- Everyone who is logged in can see and edit everything.
-- This matches the family's rule: one shared household, all editors.
alter table public.profiles enable row level security;
alter table public.pantry_items enable row level security;
alter table public.purchase_lots enable row level security;
alter table public.shopping_items enable row level security;

create policy "logged in can read profiles" on public.profiles for select using (auth.role() = 'authenticated');
create policy "logged in can write profiles" on public.profiles for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "logged in can read pantry" on public.pantry_items for select using (auth.role() = 'authenticated');
create policy "logged in can write pantry" on public.pantry_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "logged in can read lots" on public.purchase_lots for select using (auth.role() = 'authenticated');
create policy "logged in can write lots" on public.purchase_lots for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "logged in can read shopping" on public.shopping_items for select using (auth.role() = 'authenticated');
create policy "logged in can write shopping" on public.shopping_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Realtime (live sync) for pantry + shopping list.
-- In Supabase: Database > Replication, or run:
-- alter publication supabase_realtime add table public.pantry_items;
-- alter publication supabase_realtime add table public.shopping_items;
