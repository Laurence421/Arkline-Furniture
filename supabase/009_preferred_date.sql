-- Run once in Supabase → SQL Editor (after 008). Safe to re-run.
-- Optional preferred date from the form: delivery date for orders, visit or call date for price requests.
alter table public.quotation_requests
  add column if not exists preferred_date date;
