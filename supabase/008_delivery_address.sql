-- Run once in Supabase → SQL Editor (after 007). Safe to re-run.
-- Delivery address from the "Place an order" tab, so the shop can quote the delivery fee.
alter table public.quotation_requests
  add column if not exists delivery_address text check (char_length(delivery_address) <= 300);
