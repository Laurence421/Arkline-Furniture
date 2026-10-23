-- Run once in Supabase → SQL Editor (after schema.sql). Adds private notes for the admin Quotes tab.
alter table public.quotation_requests
  add column if not exists notes text check (char_length(notes) <= 5000);
