// Gallery categories for /admin, stored in the categories table (the built-in list is only a fallback
// until it loads). Removing a built-in category hides it and its original photos from the website;
// adding a category with the same name brings them back.
import { ORDER } from "./data.js";
import { supabase } from "./supabase.js";

let list = [...ORDER];
export const categories = () => list;
export const isBuiltIn = c => ORDER.includes(c);
export const NEEDS_007 = "Categories need one database update: run supabase/007_categories.sql in the Supabase SQL Editor.";
const missing = e => /does not exist|schema cache|Could not find the table/i.test(e?.message || "");

export async function loadCategories(){
  const { data, error } = await supabase.from("categories").select("name").order("sort").order("created_at");
  if (!error) list = data.map(r => r.name);
  return error ? (missing(error) ? NEEDS_007 : error.message) : "";
}

export async function addCategory(name){
  name = name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 40) return "Use 2 to 40 characters.";
  if (!/^[\p{L}\p{N} &'(),./-]+$/u.test(name)) return "Use letters, numbers, spaces and simple punctuation only.";
  if (list.some(c => c.toLowerCase() === name.toLowerCase())) return `"${name}" already exists.`;
  const builtIn = ORDER.find(c => c.toLowerCase() === name.toLowerCase());
  if (builtIn) name = builtIn; // bringing back a built-in category: original spelling and place in the list
  const { error } = await supabase.from("categories").insert({ name, sort: builtIn ? ORDER.indexOf(builtIn) + 1 : Math.max(ORDER.length, list.length) + 1 });
  if (error) return missing(error) ? NEEDS_007 : error.message;
  list = builtIn ? ORDER.filter(c => c === name || list.includes(c)).concat(list.filter(c => !ORDER.includes(c))) : [...list, name];
  return "";
}

export async function deleteCategory(name){
  const { error } = await supabase.from("categories").delete().eq("name", name);
  if (error) return error.code === "23503" ? `"${name}" still has photos (check Trash too). Delete them forever first.` : (missing(error) ? NEEDS_007 : error.message);
  list = list.filter(c => c !== name);
  return "";
}
