-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Requests can be moved to Trash (deleted_at set) and restored; "Delete forever" erases the row
-- and the customer's private photo. Only admins can do either.
alter table public.quotation_requests
  add column if not exists deleted_at timestamptz;

drop policy if exists "admins delete quotes" on public.quotation_requests;
create policy "admins delete quotes" on public.quotation_requests
  for delete to authenticated using (public.is_admin());

drop policy if exists "admins delete quote attachments" on storage.objects;
create policy "admins delete quote attachments" on storage.objects
  for delete to authenticated using (bucket_id = 'quote-attachments' and public.is_admin());
