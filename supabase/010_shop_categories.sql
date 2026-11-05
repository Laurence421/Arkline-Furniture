-- Run once in Supabase → SQL Editor (after 009). Safe to re-run.
-- 1) The shop gets every category from the old website, not only chairs and office tables.
-- 2) Prices keep their centavos (e.g. ₱20,446.99), in products and in saved order totals.
alter table public.products drop constraint if exists products_kind_check;
alter table public.products add constraint products_kind_check check (kind in
  ('chair','exec-chair','visitor-chair','gang-chair','table','exec-table','conference','workstation',
   'reception','pedestal','steel-cabinet','locker','rack'));
alter table public.products alter column price_min type numeric(12,2), alter column price_max type numeric(12,2);
alter table public.quotation_requests alter column estimate_min type numeric(14,2), alter column estimate_max type numeric(14,2);
