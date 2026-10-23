// Resize in the browser and re-encode as WebP (JPEG where WebP encoding is unsupported).
// With { watermark: true } the Arkline badge (/img/watermark.png) is drawn bottom-right, sized like
// the one stamped on the bundled photos, so an unmarked copy never leaves the admin's device.
let mark;
const loadMark = () => mark ??= new Promise((res, rej) => {
  const im = new Image(); im.onload = () => res(im); im.onerror = () => { mark = null; rej(new Error("Couldn't load the watermark.")); };
  im.src = "/img/watermark.png";
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
    const im = await loadMark();
    const ww = Math.round(Math.min(Math.max(width * .24, 90), width * .45)), wh = Math.round(ww * im.height / im.width), m = Math.round(Math.max(width * .025, 6));
    ctx.drawImage(im, width - ww - m, height - wh - m, ww, wh);
  }
  const enc = type => new Promise(res => c.toBlob(res, type, quality));
  let blob = await enc("image/webp");
  if(!blob || blob.type !== "image/webp") blob = await enc("image/jpeg");
  if(!blob) throw new Error("Couldn't process "+file.name+".");
  return { blob, width, height, ext: blob.type === "image/webp" ? "webp" : "jpg" };
}
