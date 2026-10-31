-- Run once in Supabase → SQL Editor (after 007). Safe to re-run.
-- 1) Delivery address from the "Place an order" tab, so the shop can quote the delivery fee.
-- 2) When the owner last worked on a request (reply, note, Done, Reopen). Replied requests with no
--    activity for 30 days move to Done by themselves.
alter table public.quotation_requests
  add column if not exists delivery_address text check (char_length(delivery_address) <= 300),
  add column if not exists last_activity_at timestamptz;
