// Resize in the browser and re-encode as WebP (JPEG where WebP encoding is unsupported).
export async function toWebp(file, max = 1920, quality = .8){
  if(!file.type.startsWith("image/")) throw new Error(file.name+" is not an image.");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * s), height = Math.round(bmp.height * s);
  const c = document.createElement("canvas"); c.width = width; c.height = height;
  c.getContext("2d").drawImage(bmp, 0, 0, width, height); bmp.close?.();
  const enc = type => new Promise(res => c.toBlob(res, type, quality));
  let blob = await enc("image/webp");
  if(!blob || blob.type !== "image/webp") blob = await enc("image/jpeg");
  if(!blob) throw new Error("Couldn't process "+file.name+".");
  return { blob, width, height, ext: blob.type === "image/webp" ? "webp" : "jpg" };
}
