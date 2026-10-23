# ADR-001: Static Vite site on Vercel, Supabase for photos and quotation requests

**Status:** Accepted — hosting later moved from Vercel to Cloudflare Pages (free plan allows commercial use); the rest stands.
**Date:** 2026-10-23
**Deciders:** Arkline owner, site developer

## Context
The prototype at claude.ai is a single static page. Going live needs three things it fakes:
(A) the client uploads completed-project photos without a developer, (B) "Request a free quotation"
actually reaches Arkline, with an optional reference photo, and (C) Arkline is alerted to each new
request so the "we usually reply within one business day" promise holds. Budget is free tier;
traffic is a local furniture shop's (well under 10k visits/month); one developer maintains it.

## Decision
- **Frontend:** the prototype's vanilla HTML/CSS/JS, split into modules and built with Vite (two pages: `/` and `/admin`). No framework.
- **Hosting + API:** Vercel. One serverless function, `POST /api/quote`.
- **Data:** Supabase Postgres (`projects`, `quotation_requests`, `admins`) and Storage (`project-photos` public, `quote-attachments` private). Row Level Security on every table.
- **Admin auth:** Supabase email/password, public sign-up disabled, access gated by the `admins` table.
- **Image optimisation:** done in the browser (canvas → WebP, max 1920 px), so no image service is needed.
- **Alerts:** the API route emails Arkline through Resend after the row is saved.

## Options Considered

### Quote submission path
| Option | Complexity | Cost | Abuse control | Notes |
|---|---|---|---|---|
| **Vercel function → Supabase (chosen)** | Low | Free | Server validates, recomputes prices, honeypot | Service key stays server-side |
| Browser inserts directly with anon key + RLS insert policy | Lowest | Free | Weak: anyone can script inserts and upload to the bucket | No server to validate or send email |
| Form service (Formspree / Web3Forms) | Lowest | Free tier caps ~50–250/mo | Vendor's | Leads live in a vendor inbox, not our DB |

### New-request alert (Feature C)
| Option | Complexity | Moving parts | Failure mode |
|---|---|---|---|
| **Email from `/api/quote` via Resend (chosen)** | Low | 1 function, 1 API key | Email fails → row still saved, error logged |
| Supabase Database Webhook → Edge Function → Resend | Medium | Webhook + Edge Function + secrets in two places | Same; harder to debug, second deploy target |
| Supabase built-in auth emails | n/a | — | Only sends auth mail; can't notify on table inserts |

## Trade-off Analysis
Routing quotes through one Vercel function costs a little latency but buys server-side validation,
price recomputation from `src/data.js` (the browser can't fake an estimate), a private attachments
bucket, and a single place to send the alert. Sending the alert from the same function instead of a
database webhook keeps the system to one deploy target; the cost is that a row inserted any other way
(e.g. by hand in the dashboard) won't email, which is acceptable.

Free-tier headroom: 5 GB Storage ≈ 25,000 photos at ~200 KB; 500 MB DB ≈ 400,000+ quote rows at
<1 KB; Resend free = 3,000 emails/month, 100/day. Supabase pauses free projects after 7 days without
activity; real site traffic keeps it awake, but a quiet launch week could trigger it.

## Consequences
- Easier: the client adds photos from a phone; every lead is in a queryable table with a `status` column.
- Harder: three dashboards (Vercel, Supabase, Resend) and five env vars to manage.
- Revisit: rate limiting on `/api/quote` if spam gets past the honeypot (Vercel WAF or a per-IP check);
  an admin "Quotes" view so the client needn't open Supabase.
- Deletes are soft: uploaded photos get `projects.deleted_at`, bundled photos get a `hidden_photos` row,
  and both show in the admin Trash with Restore. Only uploaded photos can be deleted forever.

## Action Items
1. [ ] Create Supabase project, run `supabase/schema.sql`, disable sign-ups, create the admin user and insert it into `admins`.
2. [ ] Create Resend account, verify a sending domain, set `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM`.
3. [ ] Import the repo into Vercel, set all env vars from `.env.example`, deploy.
4. [ ] Submit a test quote with a photo; confirm the row, the attachment and the email.
5. [ ] Upload one test photo from `/admin` on a phone; confirm it appears in the gallery.
