// POST /api/quote — saves a quotation request to Supabase and emails Arkline.
// Host-neutral: handleQuote(request, env). Cloudflare Pages calls it from functions/api/quote.js;
// POST below serves Vercel and the Vite dev server.
import { createClient } from "@supabase/supabase-js";
import { ALL, PROJECT_TYPES, pt } from "../src/data.js";

const MAX_PHOTO = 5 * 1024 * 1024;
const PHOTO_TYPES = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const json = (body, status = 200) => Response.json(body, { status });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const field = (fd, k, max) => String(fd.get(k) ?? "").trim().slice(0, max);

export const POST = request => handleQuote(request, process.env);

export async function handleQuote(request, env) {
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

  if (!name) return json({ error: "Add your name so we know who to address the quotation to." }, 400);
  if (!okPhone && !okEmail) return json({ error: "Add a mobile number (09XX XXX XXXX) or an email so we can send your quotation." }, 400);
  if (!PROJECT_TYPES.includes(type)) return json({ error: "Choose a project type." }, 400);

  // Prices are recomputed here from the catalogue; the browser only sends ids and quantities.
  let items = [];
  try { items = JSON.parse(field(fd, "items", 4000) || "[]"); } catch {}
  items = (Array.isArray(items) ? items : [])
    .filter(i => ALL[i?.id]).slice(0, 50)
    .map(i => ({ id: i.id, name: ALL[i.id].name, qty: Math.max(1, Math.min(99, parseInt(i.qty) || 1)) }));
  const min = items.reduce((s, i) => s + ALL[i.id].min * i.qty, 0);
  const max = items.reduce((s, i) => s + ALL[i.id].max * i.qty, 0);

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
    return json({ error: "Our quotation form is temporarily unavailable. Please call or email us instead." }, 503);
  }
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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

  const { data: row, error } = await db.from("quotation_requests").insert({
    full_name: name, mobile: okPhone ? phone : null, email: okEmail ? email : null,
    project_type: type, message: message || null, quote_items: items,
    estimate_min: items.length ? min : null, estimate_max: items.length ? max : null, attachment_path
  }).select("id, created_at").single();
  if (error) {
    console.error("insert quote", error);
    if (attachment_path) await db.storage.from("quote-attachments").remove([attachment_path]);
    return json({ error: "We couldn't save your request just now. Please call or email us instead." }, 502);
  }

  // The lead is saved; a failed alert is logged but never fails the request.
  try { await notify(env, db, row, { name, phone: okPhone ? phone : "", email: okEmail ? email : "", type, message, items, min, max, attachment_path }); }
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
  const list = q.items.length
    ? `<ul>${q.items.map(i => `<li>${i.qty} × ${esc(i.id)} ${esc(i.name)}</li>`).join("")}</ul><p>Estimated total: ${esc(pt({ min: q.min, max: q.max }))}</p>`
    : "<p>No catalogue items selected.</p>";
  const html = `<h2>New quotation request #${row.id}</h2>
    <p><b>${esc(q.name)}</b> · ${esc(q.type)}</p>
    <p>Mobile: ${esc(q.phone || "—")}<br>Email: ${esc(q.email || "—")}</p>
    <p style="white-space:pre-wrap">${esc(q.message || "(no message)")}</p>${list}${photoLink}`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: `New quotation request #${row.id} from ${q.name}`, html, ...(q.email && { reply_to: q.email }) })
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}
