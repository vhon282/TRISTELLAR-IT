-- Public Wi-Fi voucher registration submissions from the standalone Ruijie redirect form.
-- Allows unauthenticated Wi-Fi users (anon) to INSERT their user information
-- while restricting SELECT/DELETE access to authenticated CMMS IT operators.
create table if not exists public.wifi_voucher_submissions (
  id text primary key,
  voucher_code text not null default '',
  full_name text not null,
  employee_number text not null default '',
  user_group text not null default 'Employee' check (user_group in ('Employee', 'GUEST')),
  department text not null default '',
  branch_location text not null default '',
  device_type text not null default 'Company Laptop',
  alias text not null default '',
  phone_number text not null default '',
  mac_address text not null default '',
  submitted_at timestamptz not null default now()
);

create index if not exists idx_wifi_voucher_submissions_code
  on public.wifi_voucher_submissions (lower(voucher_code));

create index if not exists idx_wifi_voucher_submissions_submitted_at
  on public.wifi_voucher_submissions (submitted_at desc);

alter table public.wifi_voucher_submissions enable row level security;

revoke all on table public.wifi_voucher_submissions from anon, authenticated;
grant insert on table public.wifi_voucher_submissions to anon, authenticated;
grant select, delete on table public.wifi_voucher_submissions to authenticated;

drop policy if exists "Public can submit wifi voucher registration" on public.wifi_voucher_submissions;
create policy "Public can submit wifi voucher registration"
  on public.wifi_voucher_submissions for insert to anon, authenticated
  with check (length(trim(full_name)) > 0);

drop policy if exists "Authenticated operators can read voucher submissions" on public.wifi_voucher_submissions;
create policy "Authenticated operators can read voucher submissions"
  on public.wifi_voucher_submissions for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "Authenticated operators can delete voucher submissions" on public.wifi_voucher_submissions;
create policy "Authenticated operators can delete voucher submissions"
  on public.wifi_voucher_submissions for delete to authenticated
  using (auth.uid() is not null);
