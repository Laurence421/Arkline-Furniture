-- Run once in Supabase → SQL Editor (after 004). Safe to re-run.
-- 1) How the customer wants to be contacted, and their Facebook for Messenger.
alter table public.quotation_requests
  add column if not exists contact_pref text check (contact_pref in ('Call or text','Viber','Messenger','Email')),
  add column if not exists facebook text check (char_length(facebook) <= 200);

-- 2) Allow Arkline's Messenger page and Viber number as editable website text.
alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content add constraint site_content_key_check check (key in ('hero.location', 'hero.title', 'hero.lede', 'shop.lede', 'services', 'about.title', 'about.lead', 'steps', 'faq', 'contact.address', 'contact.mobiles', 'contact.email', 'contact.messenger', 'contact.viber', 'contact.reply', 'footer.tagline', 'gallery.from'));
