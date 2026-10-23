-- Run once in Supabase → SQL Editor (after 003). Safe to re-run.
-- 1) Photos a customer tapped "I want one like this" on, saved with their request.
alter table public.quotation_requests
  add column if not exists liked_photos jsonb not null default '[]';

-- 2) Allow the admin-edited "starts at" prices for gallery categories (key gallery.from).
alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content add constraint site_content_key_check check (key in ('hero.location', 'hero.title', 'hero.lede', 'shop.lede', 'services', 'about.title', 'about.lead', 'steps', 'faq', 'contact.address', 'contact.mobiles', 'contact.email', 'contact.reply', 'footer.tagline', 'gallery.from'));
