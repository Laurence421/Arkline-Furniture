# Arkline Home & Office Furniture — website

Vite (vanilla JS) site with Supabase for project photos and quotation requests. Runs entirely on free plans:
Cloudflare Pages (hosting, commercial use allowed), Supabase (database, photos, sign-in), Resend (alert email),
GitHub Actions (keeps Supabase awake). Design rationale: [docs/adr/ADR-001-vercel-supabase-stack.md](docs/adr/ADR-001-vercel-supabase-stack.md).
How it works, for the client: [docs/arkline-website-flow.pdf](docs/arkline-website-flow.pdf).

| Path | What it is |
|---|---|
| `index.html`, `src/main.js`, `src/styles.css` | Public site: gallery, shop, quote list, quotation form, chat buttons |
| `admin.html`, `src/admin.js`, `src/auth.js` | `/admin`: Quotes inbox, photo upload, Trash; Google / email sign-in with password reset |
| `api/quote.js` | Quote handler: validates, spam check, saves to Supabase, emails Arkline |
| `functions/api/quote.js` | Cloudflare Pages wrapper for the handler (`POST /api/quote`) |
| `api/site-data.js`, `functions/api/site-data.js` | `GET /api/site-data`: gallery, prices and text in one request, cached 30 s (100 visitors ≈ one set of database reads) |
| `src/icons.js` | The icons the site uses, bundled. Add new `data-lucide` names here |
| `src/data.js`, `src/content.js` | Built-in catalogue and website text (used until the admin saves changes), photo list, chat links |
| `supabase/schema.sql`, `002_quotes_admin.sql`, `003_prices_and_text.sql` | Tables, access rules, storage buckets; notes; editable products and text |
| `.github/workflows/keep-supabase-awake.yml` | Daily ping so the free Supabase project never pauses |
| `public/img/` | Bundled photos (WebP; JPG kept for social previews). `npm run webp` regenerates |

## Local development

```sh
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev                  # http://localhost:5173 (site, /admin.html and /api/quote)
npm run build                # production build to dist/
```

Without Supabase keys the quote form runs in demo mode (logs to the terminal, saves nothing).

## Deploy free on Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo.
2. Build command `npm run build`, output directory `dist`.
3. **Settings → Variables and secrets**: add every value from `.env.local` (the `VITE_` ones are needed at build time, the others at runtime). Mark the secret key as *Encrypt*.
4. Deploy. The site is at `https://<project>.pages.dev`; `/admin` and `/api/quote` work automatically.
5. Add the new address in Supabase → Authentication → URL Configuration (Site URL and Redirect URLs `https://<project>.pages.dev/**`).

## Optional free extras

- **Alert emails**: sign up at resend.com with the address in `NOTIFY_EMAIL`, create an API key, set `RESEND_API_KEY`.
- **Spam check**: Cloudflare → Turnstile → Add widget (your pages.dev domain and `localhost`) → set `VITE_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
- **Messenger / Viber buttons**: `/admin` → Website text → Contact details (Facebook page and Viber number).

## Day to day

- **New request**: alert email (if Resend is set) and the **Quotes** tab in `/admin`. Set the status as you go; notes are private.
- **New photo**: `/admin` → Photos → pick a category, choose photos, Upload. They show first in the gallery.
- **Remove a photo**: trash icon → **Trash** at the bottom of the Photos tab. Restore puts it back; uploaded photos can be deleted forever.
- **Prices and products**: `/admin` → Prices. Edit, add or hide items; quote estimates use these prices.
- **Website text**: `/admin` → Website text. Hero, shop intro, services, about, how to order, FAQs, contact details, footer. "Restore original" undoes a section.
