-- Run this migration in Supabase SQL Editor (or apply it through Supabase CLI).
-- The app stores the complete CMMS state as one JSONB snapshot. Access is restricted
-- to authenticated Supabase Auth users; never enable anon access for this table.
create table if not exists public.cmms_state (
  id smallint primary key check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.cmms_state enable row level security;
revoke all on table public.cmms_state from anon, authenticated;
grant select, insert, update on table public.cmms_state to authenticated;

drop policy if exists "Authenticated users can read CMMS state" on public.cmms_state;
create policy "Authenticated users can read CMMS state"
  on public.cmms_state for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "Authenticated users can create CMMS state" on public.cmms_state;
create policy "Authenticated users can create CMMS state"
  on public.cmms_state for insert to authenticated
  with check (auth.uid() is not null and (updated_by is null or updated_by = auth.uid()));

drop policy if exists "Authenticated users can update CMMS state" on public.cmms_state;
create policy "Authenticated users can update CMMS state"
  on public.cmms_state for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null and (updated_by is null or updated_by = auth.uid()));
