-- Arkline Furniture: run once in Supabase → SQL Editor.
-- Then: Authentication → Providers → Email → turn OFF "Allow new users to sign up",
-- create the client's user under Authentication → Users, and add them as admin (bottom of file).

-- Admins ---------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;
create policy "admins see themselves" on public.admins
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Feature A: project photos ---------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'Executive Table','Workstation','Conference Table','Cubicle Partition','Reception Counter',
    'Toilet Partition','Kitchen Cabinet','Cabinet','Printer Table')),
  caption text check (char_length(caption) <= 200),
  storage_path text not null unique,
  width int,
  height int,
  created_at timestamptz not null default now(),
  deleted_at timestamptz  -- set = in the admin Trash, hidden from the site
);
create index if not exists projects_created_idx on public.projects (created_at desc);
alter table public.projects enable row level security;
create policy "anyone views live projects, admins view all" on public.projects
  for select to anon, authenticated using (deleted_at is null or public.is_admin());
create policy "admins add projects" on public.projects
  for insert to authenticated with check (public.is_admin());
create policy "admins trash and restore projects" on public.projects
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete projects" on public.projects
  for delete to authenticated using (public.is_admin());

-- Bundled photos (public/img/pN.jpg) an admin moved to Trash. photo = N.
create table if not exists public.hidden_photos (
  photo int primary key,
  created_at timestamptz not null default now()
);
alter table public.hidden_photos enable row level security;
create policy "anyone can view hidden list" on public.hidden_photos
  for select to anon, authenticated using (true);
create policy "admins hide photos" on public.hidden_photos
  for insert to authenticated with check (public.is_admin());
create policy "admins restore photos" on public.hidden_photos
  for delete to authenticated using (public.is_admin());

-- Feature B: quotation requests -----------------------------------------
-- No anon policies: rows are written only by /api/quote with the service role key.
create table if not exists public.quotation_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 1 and 120),
  mobile text check (char_length(mobile) <= 20),
  email text check (char_length(email) <= 200),
  project_type text not null,
  message text check (char_length(message) <= 5000),
  quote_items jsonb not null default '[]',
  estimate_min int,
  estimate_max int,
  attachment_path text,
  status text not null default 'new' check (status in ('new','contacted','quoted','closed')),
  check (mobile is not null or email is not null)
);
create index if not exists quotes_created_idx on public.quotation_requests (created_at desc);
alter table public.quotation_requests enable row level security;
create policy "admins read quotes" on public.quotation_requests
  for select to authenticated using (public.is_admin());
create policy "admins update quotes" on public.quotation_requests
  for update to authenticated using (public.is_admin());

-- Storage buckets ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('project-photos', 'project-photos', true, 2097152, array['image/webp','image/jpeg']),
  ('quote-attachments', 'quote-attachments', false, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "admins read project photos" on storage.objects
  for select to authenticated using (bucket_id = 'project-photos' and public.is_admin());
create policy "admins upload project photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'project-photos' and public.is_admin());
create policy "admins delete project photos" on storage.objects
  for delete to authenticated using (bucket_id = 'project-photos' and public.is_admin());
create policy "admins read quote attachments" on storage.objects
  for select to authenticated using (bucket_id = 'quote-attachments' and public.is_admin());

-- Make the client an admin (replace the email, run after creating the user):
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'arklinehomeandofficefurnitures@gmail.com';
