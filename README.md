# Arkline Home & Office Furniture — website

Vite (vanilla JS) site on Vercel, with Supabase for project photos and quotation requests.
Design rationale: [docs/adr/ADR-001-vercel-supabase-stack.md](docs/adr/ADR-001-vercel-supabase-stack.md).

| Path | What it is |
|---|---|
| `index.html`, `src/main.js`, `src/styles.css` | Public site (gallery, shop, quote list, quotation form) |
| `admin.html`, `src/admin.js` | `/admin` — sign in and upload/delete project photos |
| `api/quote.js` | `POST /api/quote` — validates, saves to Supabase, emails Arkline |
| `src/data.js` | Catalogue, prices and bundled photo list (shared by site and API) |
| `supabase/schema.sql` | Tables, RLS policies, storage buckets |
| `public/img/` | Bundled photos and logos |

## Setup

1. **Supabase**: create a project, open SQL Editor and run `supabase/schema.sql`.
   - Authentication → Providers → Email: turn off **Allow new users to sign up**.
   - Authentication → Users → **Add user**: `arklinefurniture3@gmail.com`, set a password, tick **Auto Confirm User**.
   - Run the `insert into public.admins …` statement at the bottom of the schema again (it's a no-op until that user exists).
2. **Resend** (for new-quote emails): create an account, verify a domain, create an API key.
   Without it, requests are still saved; you just don't get the email.
3. **Env vars**: copy `.env.example` to `.env.local` for local dev, and add the same values in
   Vercel → Project → Settings → Environment Variables.
4. **Deploy**: import the folder into Vercel (framework preset: Vite). Done.

## Local development

```sh
npm install
npx vercel dev      # site + /api/quote on http://localhost:3000
npm run dev:static  # site only (form submit will fail without the API)
npm run build       # production build to dist/
```

## Day to day

- **New photo**: go to `/admin`, sign in, pick a category, choose photos, Upload. They show first in the gallery.
- **Remove a photo**: the trash icon on any photo (uploaded or original) moves it to **Trash** at the bottom of `/admin`.
  From Trash, **Restore** puts it back; uploaded photos can also be **Deleted forever** (frees storage).
  Original photos are files in `public/img`, so they can only be restored, not deleted forever.
- **New quote**: arrives by email; all requests are in Supabase → Table Editor → `quotation_requests`
  (set `status` as you work them). Reference photos are in Storage → `quote-attachments`.
- **Prices / catalogue**: edit `src/data.js` and redeploy.
