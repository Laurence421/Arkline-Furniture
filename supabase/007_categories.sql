-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Gallery categories become a table the admin can add to ("Add category" in /admin → Photos).
create table if not exists public.categories (
  name text primary key check (char_length(name) between 2 and 40),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
drop policy if exists "anyone reads categories" on public.categories;
create policy "anyone reads categories" on public.categories
  for select to anon, authenticated using (true);
drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The built-in categories (their photos ship with the website)
insert into public.categories (name, sort) values
  ('Executive Table', 1), ('Workstation', 2), ('Conference Table', 3), ('Cubicle Partition', 4),
  ('Reception Counter', 5), ('Toilet Partition', 6), ('Kitchen Cabinet', 7), ('Cabinet', 8),
  ('Printer Table', 9), ('Operable Wall', 10)
on conflict (name) do nothing;

-- Uploaded photos may use any category in the table (was a fixed list of 9).
-- A category that still has uploaded photos can't be deleted; renaming one updates its photos.
alter table public.projects drop constraint if exists projects_category_check;
alter table public.projects drop constraint if exists projects_category_fkey;
alter table public.projects add constraint projects_category_fkey
  foreign key (category) references public.categories (name) on update cascade on delete restrict;
