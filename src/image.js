// Resize in the browser and re-encode as WebP (JPEG where WebP encoding is unsupported).
// With { watermark: true } the see-through Arkline logo is drawn across the centre (/img/watermark-center.png),
// matching the bundled photos, so an unmarked copy never leaves the admin's device.
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
    const center = await load("/img/watermark-center.png");
    const cw = Math.round(Math.min(width * .5, height * .6 * center.width / center.height)), ch = Math.round(cw * center.height / center.width);
    ctx.drawImage(center, Math.round((width - cw) / 2), Math.round((height - ch) / 2), cw, ch);
  }
  const enc = type => new Promise(res => c.toBlob(res, type, quality));
  let blob = await enc("image/webp");
  if(!blob || blob.type !== "image/webp") blob = await enc("image/jpeg");
  if(!blob) throw new Error("Couldn't process "+file.name+".");
  return { blob, width, height, ext: blob.type === "image/webp" ? "webp" : "jpg" };
}
