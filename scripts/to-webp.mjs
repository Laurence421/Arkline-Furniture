// One-off: write a .webp next to every .jpg in public/img (max 1600 px, quality 78). Run: node scripts/to-webp.mjs
import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";

const dir = new URL("../public/img/", import.meta.url);
let before = 0, after = 0;
for (const f of (await readdir(dir)).filter(f => f.endsWith(".jpg"))) {
  const src = new URL(f, dir), out = new URL(f.replace(/\.jpg$/, ".webp"), dir);
  await sharp(src.pathname.slice(1)).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toFile(out.pathname.slice(1));
  before += (await stat(src)).size; after += (await stat(out)).size;
}
console.log(`jpg ${Math.round(before / 1024)} KB → webp ${Math.round(after / 1024)} KB`);
