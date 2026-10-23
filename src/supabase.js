import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// null when env is missing: the site still works on its bundled photos.
export const supabase = url && key ? createClient(url, key) : null;
export const PHOTO_BUCKET = "project-photos";
export const photoUrl = path => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
