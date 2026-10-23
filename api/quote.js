// POST /api/quote — saves a quotation request to Supabase and emails Arkline.
// Host-neutral: handleQuote(request, env). Cloudflare Pages calls it from functions/api/quote.js;
// POST below serves Vercel and the Vite dev server.
import { createClient } from "@supabase/supabase-js";
import { ALL, BUNDLED, CATS, CONTACT_PREFS, PROJECT_TYPES, fromRow, pt } from "../src/data.js";

const MAX_PHOTO = 5 * 1024 * 1024;
const PHOTO_TYPES = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const json = (body, status = 200) => Response.json(body, { status });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const field = (fd, k, max) => String(fd.get(k) ?? "").trim().slice(0, max);

export const POST = request => handleQuote(request, process.env);

// Visible products, kept in memory for 60 s so a rush of orders reads the price list once, not per order.
let prices = null, pricesAt = 0;
async function priceList(db) {
  if (prices && Date.now() - pricesAt < 60_000) return prices;
  const { data, error } = await db.from("products").select("*").eq("visible", true);
  if (error) return prices || ALL; // table unavailable: last good copy, else the built-in list
  prices = Object.fromEntries(data.map(r => [r.id, fromRow(r)])); pricesAt = Date.now();
  return prices;
}

// Spam guard: at most 5 sends per visitor IP per 10 minutes (per server instance; Cloudflare always sends the IP).
const LIMIT = 5, WINDOW = 10 * 60_000, hits = new Map();
function tooMany(ip) {
  if (!ip) return false;
  const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  hits.set(ip, [...recent, now]);
  return recent.length >= LIMIT;
}

export async function handleQuote(request, env) {
  if (tooMany(request.headers.get("cf-connecting-ip")))
    return json({ error: "You've sent several requests in a short time. Please wait a few minutes, or call or message us." }, 429);
  let fd;
  try { fd = await request.formData(); } catch { return json({ error: "Invalid form submission." }, 400); }

  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (field(fd, "website", 200)) return json({ ok: true });

  const name = field(fd, "name", 120);
  const phone = field(fd, "phone", 20).replace(/[\s-]/g, "");
  const email = field(fd, "email", 200);
  const type = field(fd, "type", 60);
  const message = field(fd, "message", 5000);
  const okPhone = /^(09|\+639)\d{9}$/.test(phone), okEmail = /^\S+@\S+\.\S+$/.test(email);

  if (!name) return json({ error: "Add your name so we know who to send the price to." }, 400);
  if (!okPhone && !okEmail) return json({ error: "Add a mobile number (09XX XXX XXXX) or an email so we can send you the price." }, 400);
  if (!PROJECT_TYPES.includes(type)) return json({ error: "Choose a project type." }, 400);
  const pref = CONTACT_PREFS.includes(field(fd, "pref", 30)) ? field(fd, "pref", 30) : "Call or text";
  const facebook = field(fd, "facebook", 200);
  if ((pref === "Call or text" || pref === "Viber") && !okPhone) return json({ error: "Add your mobile number so we can reach you." }, 400);
  if (pref === "Email" && !okEmail) return json({ error: "Add your email so we can reply by email." }, 400);
  if (pref === "Messenger" && !facebook) return json({ error: "Add your Facebook name or link so we can message you." }, 400);

  let raw = [];
  try { raw = JSON.parse(field(fd, "items", 4000) || "[]"); } catch {}
  raw = (Array.isArray(raw) ? raw : []).filter(i => typeof i?.id === "string").slice(0, 50);

  // Gallery photos the customer tapped "I want one like this" on: only our own photos are accepted.
  let liked = [];
  try { liked = JSON.parse(field(fd, "liked", 4000) || "[]"); } catch {}
  const bundled = new Set(BUNDLED.map(b => b.src)), uploads = `${env.SUPABASE_URL}/storage/v1/object/public/project-photos/`;
  liked = (Array.isArray(liked) ? liked : [])
    .filter(l => CATS[l?.cat] && typeof l.src === "string" && (bundled.has(l.src) || (env.SUPABASE_URL && l.src.startsWith(uploads))))
    .slice(0, 12).map(l => ({ cat: l.cat, src: l.src }));

  // Cloudflare Turnstile: enforced only when the secret is configured.
  if (env.TURNSTILE_SECRET_KEY) {
    const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: field(fd, "cf-turnstile-response", 2048), remoteip: request.headers.get("cf-connecting-ip") || "" })
    }).then(r => r.json()).catch(() => ({ success: false }));
    if (!v.success) return json({ error: "Please complete the security check and send again." }, 400);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    return json({ error: "Our price request form is temporarily unavailable. Please call or email us instead." }, 503);
  }
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Prices are recomputed here from the admin-edited products table (built-in list if it's unavailable);
  // the browser only sends ids and quantities.
  const catalog = raw.length ? await priceList(db) : ALL;
  const items = raw.filter(i => catalog[i.id])
    .map(i => ({ id: i.id, name: catalog[i.id].name, qty: Math.max(1, Math.min(99, parseInt(i.qty) || 1)) }));
  const min = items.reduce((s, i) => s + catalog[i.id].min * i.qty, 0);
  const max = items.reduce((s, i) => s + catalog[i.id].max * i.qty, 0);

  let attachment_path = null;
  const photo = fd.get("photo");
  if (photo && typeof photo === "object" && photo.size) {
    const ext = PHOTO_TYPES[photo.type];
    if (!ext) return json({ error: "The reference photo must be a JPG, PNG or WebP image." }, 400);
    if (photo.size > MAX_PHOTO) return json({ error: "The reference photo is over 5 MB. Try a smaller one." }, 400);
    attachment_path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("quote-attachments")
      .upload(attachment_path, await photo.arrayBuffer(), { contentType: photo.type });
    if (error) { console.error("attachment upload", error); return json({ error: "We couldn't upload your photo. Try again, or send without it." }, 502); }
  }

  const record = {
    full_name: name, mobile: okPhone ? phone : null, email: okEmail ? email : null,
    project_type: type, message: message || null, quote_items: items,
    estimate_min: items.length ? min : null, estimate_max: items.length ? max : null, attachment_path, liked_photos: liked,
    contact_pref: pref, facebook: facebook || null
  };
  let { data: row, error } = await db.from("quotation_requests").insert(record).select("id, created_at").single();
  if (error && /liked_photos|contact_pref|facebook/.test(error.message)) {
    // Database not fully updated yet (004/005): keep these details in the message instead of losing the request.
    const { liked_photos, contact_pref, facebook: fb, ...rest } = record;
    rest.message = [message, `Contact by: ${pref}${facebook ? " (Facebook: " + facebook + ")" : ""}`,
      liked.length && "Liked photos: " + liked.map(l => `${l.cat} (${l.src})`).join(", ")].filter(Boolean).join("\n\n");
    ({ data: row, error } = await db.from("quotation_requests").insert(rest).select("id, created_at").single());
  }
  if (error) {
    console.error("insert quote", error);
    if (attachment_path) await db.storage.from("quote-attachments").remove([attachment_path]);
    return json({ error: "We couldn't save your request just now. Please call or email us instead." }, 502);
  }

  // The lead is saved; a failed alert is logged but never fails the request.
  const origin = new URL(request.url).origin;
  try { await notify(env, db, row, { name, phone: okPhone ? phone : "", email: okEmail ? email : "", type, message, items, min, max, attachment_path, liked: liked.map(l => ({ ...l, url: new URL(l.src, origin).href })), pref, facebook }); }
  catch (e) { console.error("notify", e); }

  return json({ ok: true, id: row.id });
}

async function notify(env, db, row, q) {
  const key = env.RESEND_API_KEY, to = env.NOTIFY_EMAIL, from = env.NOTIFY_FROM || "Arkline Website <onboarding@resend.dev>";
  if (!key || !to || !from) return;
  let photoLink = "";
  if (q.attachment_path) {
    const { data } = await db.storage.from("quote-attachments").createSignedUrl(q.attachment_path, 60 * 60 * 24 * 7);
    if (data) photoLink = `<p><a href="${esc(data.signedUrl)}">View reference photo</a> (link works for 7 days)</p>`;
  }
  const what = q.items.length ? "order" : "price request";
  const list = q.items.length
    ? `<h3>Order</h3><ul>${q.items.map(i => `<li>${i.qty} × ${esc(i.id)} ${esc(i.name)}</li>`).join("")}</ul><p>Total from the shop prices: ${esc(pt({ min: q.min, max: q.max }))}</p>`
    : "";
  const likes = q.liked.length
    ? `<h3>Wants one like these</h3><p>${q.liked.map(l => `<a href="${esc(l.url)}"><img src="${esc(l.url)}" alt="${esc(l.cat)}" width="140" style="border-radius:8px;margin:0 6px 6px 0"></a>`).join("")}</p>`
    : "";
  const html = `<h2>New ${what} #${row.id}</h2>
    <p><b>${esc(q.name)}</b> · ${esc(q.type)}</p>
    <p><b>Contact by: ${esc(q.pref)}</b><br>Mobile: ${esc(q.phone || "—")}<br>Email: ${esc(q.email || "—")}${q.facebook ? "<br>Facebook: " + esc(q.facebook) : ""}</p>
    <p style="white-space:pre-wrap">${esc(q.message || "(no message)")}</p>${list}${likes}${photoLink}`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: `New ${what} #${row.id} from ${q.name}`, html, ...(q.email && { reply_to: q.email }) })
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}
