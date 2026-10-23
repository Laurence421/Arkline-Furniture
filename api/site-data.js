// GET /api/site-data — everything the public page reads from Supabase, in one response.
// Kept in memory for 15 s, so a crowd of visitors costs the free Supabase plan one set of reads, not one per visitor.
// Uses the public (anon) key: Row Level Security still decides what's visible.
import { createClient } from "@supabase/supabase-js";

const TTL = 15_000;
let cached = null, cachedAt = 0, pending = null;

export const GET = request => handleSiteData(request, process.env);

export async function handleSiteData(request, env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ error: "Supabase isn't configured." }, { status: 503 });
  if (!cached || Date.now() - cachedAt > TTL) {
    pending ??= load(url, key).then(d => { cached = d; cachedAt = Date.now(); }).finally(() => { pending = null; });
    try { await pending; } catch (e) { if (!cached) return Response.json({ error: e.message }, { status: 502 }); } // serve stale on error
  }
  return new Response(JSON.stringify(cached), {
    // Browsers re-check every 10 s (no stale copies), so admin changes show within ~35 s; the server-side cache above protects Supabase.
    headers: { "content-type": "application/json", "cache-control": "public, max-age=10" }
  });
}

async function load(url, key) {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const [p, h, pr, c, cat] = await Promise.all([
    db.from("projects").select("category,storage_path,caption").is("deleted_at", null).order("created_at", { ascending: false }),
    db.from("hidden_photos").select("photo"),
    db.from("products").select("*").eq("visible", true).order("sort").order("id"),
    db.from("site_content").select("key,value"),
    db.from("categories").select("name").order("sort").order("created_at")
  ]);
  if ([p, h, pr, c].every(r => r.error)) throw new Error(p.error.message);
  const base = `${url}/storage/v1/object/public/project-photos/`;
  // Each part is null when its table can't be read; the page then keeps its built-in version of that part.
  return {
    projects: p.error ? null : p.data.map(r => ({ src: base + r.storage_path, cat: r.category, alt: r.caption })),
    hidden: h.error ? null : h.data.map(r => r.photo),
    products: pr.error ? null : pr.data,
    content: c.error ? null : c.data,
    categories: cat.error ? null : cat.data.map(r => r.name)
  };
}
