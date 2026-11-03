-- Run once in Supabase → SQL Editor (after 008). Safe to re-run.
-- Who gets an email for each new order or price request. Admins add or remove addresses in /admin → Account.
create table if not exists public.notify_emails (
  email text primary key check (char_length(email) between 5 and 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);
alter table public.notify_emails enable row level security;
drop policy if exists "admins manage alert emails" on public.notify_emails;
create policy "admins manage alert emails" on public.notify_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.notify_emails (email) values
  ('arklinefurniture3@gmail.com'), ('arklinehomeandofficefurnitures@gmail.com')
on conflict do nothing;
