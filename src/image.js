// Resize in the browser and re-encode as WebP (JPEG where WebP encoding is unsupported).
// With { watermark: true } both Arkline marks are drawn, matching the bundled photos, so an unmarked
// copy never leaves the admin's device: a faint wordmark across the centre (/img/watermark-center.png)
// and the logo badge bottom-right (/img/watermark.png).
const cache = {};
const load = src => cache[src] ??= new Promise((res, rej) => {
  const im = new Image(); im.onload = () => res(im); im.onerror = () => { delete cache[src]; rej(new Error("Couldn't load the watermark.")); };
  im.src = src;
});

export async function toWebp(file, max = 1920, quality = .8, { watermark = false } = {}){
  if(!file.type.startsWith("image/")) throw new Error(file.name+" is not an image.");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * s), height = Math.round(bmp.height * s);
  const c = document.createElement("canvas"); c.width = width; c.height = height;
  const ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0, width, height); bmp.close?.();
  if(watermark){
    const [center, badge] = await Promise.all([load("/img/watermark-center.png"), load("/img/watermark.png")]);
    const cw = Math.round(Math.min(Math.max(width * .55, 140), width * .8)), ch = Math.round(cw * center.height / center.width);
    ctx.drawImage(center, Math.round((width - cw) / 2), Math.round((height - ch) / 2), cw, ch);
    const bw = Math.round(Math.min(Math.max(width * .24, 90), width * .45)), bh = Math.round(bw * badge.height / badge.width), m = Math.round(Math.max(width * .025, 6));
    ctx.drawImage(badge, width - bw - m, height - bh - m, bw, bh);
  }
  const enc = type => new Promise(res => c.toBlob(res, type, quality));
  let blob = await enc("image/webp");
  if(!blob || blob.type !== "image/webp") blob = await enc("image/jpeg");
  if(!blob) throw new Error("Couldn't process "+file.name+".");
  return { blob, width, height, ext: blob.type === "image/webp" ? "webp" : "jpg" };
}
