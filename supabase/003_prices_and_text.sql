-- Run once in Supabase → SQL Editor. Lets the admin edit prices, products and website text.
-- Safe to re-run: it never overwrites edits already saved.

-- Products & prices ---------------------------------------------------------
create table if not exists public.products (
  id text primary key check (id ~ '^[A-Z]{2,4}-[0-9]{3}$'),
  kind text not null check (kind in ('chair','table')),
  name text not null check (char_length(name) between 1 and 120),
  price_min int not null check (price_min > 0),
  price_max int not null,
  image text,
  length_mm int, width_mm int, plan_extra jsonb,
  features text[] not null default '{}',
  sort int not null default 0,
  visible boolean not null default true,
  updated_at timestamptz not null default now(),
  check (price_max >= price_min)
);
alter table public.products enable row level security;
drop policy if exists "anyone views visible products, admins all" on public.products;
create policy "anyone views visible products, admins all" on public.products
  for select to anon, authenticated using (visible or public.is_admin());
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.products (id, kind, name, price_min, price_max, image, length_mm, width_mm, plan_extra, features, sort) values
  ('AOC-001', 'chair', 'Ergonomic Office Chair', 6730, 6730, '/img/p145.webp', null, null, null, array['Mesh back, fabric seat', 'Black plastic + glass fiber frame', 'Fixed lumbar support', 'T-shape adjustable armrest', 'High density foam', 'Single lock, tension adjustable']::text[], 1),
  ('AOC-002', 'chair', 'Ergonomic Office Chair', 4750, 4750, '/img/p161.webp', null, null, null, array['Mesh back, fabric seat', 'Black plastic + glass fiber frame', 'Fixed lumbar support', 'Seat-back linked fixed armrest', 'Single lock, tension adjustable']::text[], 2),
  ('AOC-003', 'chair', 'Ergonomic Office Chair', 3400, 3400, '/img/p78.webp', null, null, null, array['PP back frame', 'Cutting foam seat', 'Fixed armrest', 'Center tilt (no locking)', '100mm Class-3 gas lift']::text[], 3),
  ('AOC-004', 'chair', 'Ergonomic Office Chair', 6750, 6750, '/img/p27.webp', null, null, null, array['JYTW series mesh', 'OS-300 series seat fabric', 'Flip-up adjustable armrest', 'High density foam', 'Single lock, tension adjustable']::text[], 4),
  ('AOC-005', 'chair', 'Ergonomic Office Chair', 5820, 5820, '/img/p74.webp', null, null, null, array['Black PP+GF back frame', 'High-elastic moulded foam seat', 'PP+GF fixed armrest', 'Single lock, tension adjustable']::text[], 5),
  ('AOC-006', 'chair', 'Ergonomic Office Chair', 5550, 5550, '/img/p184.webp', null, null, null, array['Grey PP+GF back frame', 'High-elastic moulded foam seat', 'PP+GF fixed armrest', 'Single lock, tension adjustable']::text[], 6),
  ('AOC-007', 'chair', 'Ergonomic Office Chair', 5350, 5350, '/img/p8.webp', null, null, null, array['Mid-back mesh chair', 'Heavy-duty backrest', 'Adjustable lumbar support', 'Nylon black starbase']::text[], 7),
  ('AOC-008', 'chair', 'Ergonomic Office Chair', 5600, 5600, '/img/p154.webp', null, null, null, array['Mesh chair, heavy-duty black frame', 'High backrest', 'Wide chrome starbase']::text[], 8),
  ('AOC-009', 'chair', 'Ergonomic Office Chair', 2800, 2800, '/img/p204.webp', null, null, null, array['Clerical mesh chair', 'Spacious seat', 'Heavy-duty mesh']::text[], 9),
  ('AOC-010', 'chair', 'Ergonomic Office Chair', 2900, 2900, '/img/p149.webp', null, null, null, array['Clerical mesh chair', 'Spacious seat', 'Heavy-duty mesh, full back support']::text[], 10),
  ('AOC-011', 'chair', 'Ergonomic Office Chair', 2900, 2900, '/img/p197.webp', null, null, null, array['Clerical mesh chair', 'Spacious seat', 'Heavy-duty mesh, full back support']::text[], 11),
  ('AOC-012', 'chair', 'Ergonomic Office Chair', 3450, 3450, '/img/p13.webp', null, null, null, array['Mid-back chair', 'Black frame backrest with lumbar support', 'Chrome gas lift', 'Nylon black starbase']::text[], 12),
  ('AOC-013', 'chair', 'Ergonomic Office Chair', 5250, 5250, '/img/p148.webp', null, null, null, array['Clerical fabric chair', 'Spacious seat', 'Heavy-duty fabric', 'Wide chrome starbase']::text[], 13),
  ('OFT-001', 'table', 'Executive desk with side pedestal', 42000, 48000, null, 2400, 1200, null, array['Laminated woodgrain, scratch-resistant', 'Built-in 2-drawer side pedestal', 'Black accent base']::text[], 14),
  ('OFT-002', 'table', 'Steel-frame office table', 11500, 11500, null, 1200, 600, null, array['Scratch- and moisture-resistant top', 'Powder-coated steel frame', 'Custom sizes on request']::text[], 15),
  ('OFT-003', 'table', 'Office table with drawer', 12500, 12500, null, 1400, 600, null, array['Single storage drawer', 'Powder-coated steel frame', 'Various colors and finishes']::text[], 16),
  ('OFT-004', 'table', 'Executive desk, charcoal panel', 35000, 42000, null, 1800, 800, null, array['Cable management grommet', 'Charcoal modesty panel, aluminum strip', 'Heavy-duty panel construction']::text[], 17),
  ('OFT-005', 'table', 'High-gloss desk with side storage', 35000, 42000, null, 1600, 700, '{"side":[1200,400]}'::jsonb, array['High-gloss white finish', 'Side cabinet with open shelves', 'Clean architectural lines']::text[], 18),
  ('OFT-006', 'table', 'Panel-leg office table', 7890, 7890, null, 1200, 600, null, array['25mm laminated MFC top', '18mm side and modesty panels', 'PVC edge banding']::text[], 19),
  ('OFT-007', 'table', 'L-shaped panel-leg desk', 16500, 16500, null, 1600, 700, '{"ret":[600,900]}'::jsonb, array['25mm MFC top, 18mm panel legs', 'L-shaped work surface', 'Overall 1600 × 1600 mm']::text[], 20),
  ('OFT-008', 'table', 'Matte black steel-frame table', 9800, 9800, null, 1200, 600, null, array['Dual cable grommets', 'Matte black powder-coated frame', 'Floor protectors']::text[], 21),
  ('OFT-009', 'table', 'Table with 3-drawer pedestal', 11500, 11500, null, 1200, 600, null, array['2 utility + 1 file drawer', 'Metal slides, aluminum handles', 'Wood-grain MFC top']::text[], 22),
  ('OFT-010', 'table', 'White steel-frame table', 12650, 12650, null, 1200, 600, null, array['White powder-coated frame', 'Adjustable floor levelers', 'Various laminate colors']::text[], 23),
  ('OFT-011', 'table', 'L-shaped manager''s desk', 22500, 22500, null, 1800, 700, '{"ret":[450,1200]}'::jsonb, array['450mm front modesty panel', 'Main 1800 × 700, return 1200 × 450', 'Powder-coated steel frame']::text[], 24),
  ('OFT-012', 'table', 'Wood-grain desk, white frame', 11500, 11500, null, 1400, 700, null, array['Full front modesty panel', 'Dual cable grommets', 'Natural wood-grain MDF']::text[], 25),
  ('OFT-013', 'table', 'Wood-grain desk, white frame', 6000, 7500, null, 1400, 700, null, array['Price depends on size and finish', 'Full front modesty panel', 'Dual cable grommets']::text[], 26),
  ('OFT-014', 'table', 'Table with locking pedestal', 10275, 10275, null, 1200, 600, null, array['Fixed 3-drawer pedestal, central lock', 'A4 and legal filing drawer', 'Rust-resistant steel frame']::text[], 27)
on conflict (id) do nothing;

-- Website text ----------------------------------------------------------------
-- Only edited keys are stored; anything missing shows the original wording from src/content.js.
create table if not exists public.site_content (
  key text primary key check (key in ('hero.location', 'hero.title', 'hero.lede', 'shop.lede', 'services', 'about.title', 'about.lead', 'steps', 'faq', 'contact.address', 'contact.mobiles', 'contact.email', 'contact.reply', 'footer.tagline')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
drop policy if exists "anyone reads site text" on public.site_content;
create policy "anyone reads site text" on public.site_content
  for select to anon, authenticated using (true);
drop policy if exists "admins edit site text" on public.site_content;
create policy "admins edit site text" on public.site_content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notes on quotation requests (same as 002, included so one run does everything)
alter table public.quotation_requests
  add column if not exists notes text check (char_length(notes) <= 5000);
