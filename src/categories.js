// Gallery categories for /admin: the built-in ones (their photos ship with the website) plus any the
// admin adds. Stored in the categories table; falls back to the built-in list until that loads.
import { ORDER } from "./data.js";
import { supabase } from "./supabase.js";

let list = [...ORDER];
export const categories = () => list;
export const isBuiltIn = c => ORDER.includes(c);
export const NEEDS_007 = "Categories need one database update: run supabase/007_categories.sql in the Supabase SQL Editor.";
const missing = e => /does not exist|schema cache|Could not find the table/i.test(e?.message || "");

export async function loadCategories(){
  const { data, error } = await supabase.from("categories").select("name").order("sort").order("created_at");
  if (!error && data.length) list = [...data.map(r => r.name), ...ORDER.filter(c => !data.some(r => r.name === c))];
  return error ? (missing(error) ? NEEDS_007 : error.message) : "";
}

export async function addCategory(name){
  name = name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 40) return "Use 2 to 40 characters.";
  if (!/^[\p{L}\p{N} &'(),./-]+$/u.test(name)) return "Use letters, numbers, spaces and simple punctuation only.";
  if (list.some(c => c.toLowerCase() === name.toLowerCase())) return `"${name}" already exists.`;
  const { error } = await supabase.from("categories").insert({ name, sort: list.length + 1 });
  if (error) return missing(error) ? NEEDS_007 : error.message;
  list = [...list, name];
  return "";
}

export async function deleteCategory(name){
  if (isBuiltIn(name)) return "Built-in categories can't be removed.";
  const { error } = await supabase.from("categories").delete().eq("name", name);
  if (error) return error.code === "23503" ? `"${name}" still has photos (check Trash too). Delete them forever first.` : (missing(error) ? NEEDS_007 : error.message);
  list = list.filter(c => c !== name);
  return "";
}
