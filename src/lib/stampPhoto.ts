/**
 * Burn the time into an attendance photo.
 *
 * The time is in the database too, but that only travels with the record.
 * Once a check-in photo is downloaded, forwarded, or pasted into a report it
 * is just an image, and when it was taken is gone. Drawing it into the pixels
 * keeps it attached to the picture, which is the whole point of asking for a
 * photo at all.
 *
 * Ported from the Bharath Builders app's geoStamp (read-only reference),
 * trimmed to time only. That app's staff are spread over construction sites,
 * so its caption carries GPS and a reverse-geocoded address; this clinic has
 * one address and everyone checks in at it, so a location permission prompt
 * would buy nothing. The caption is built in one place below so a location
 * line can be added later without touching the drawing code.
 *
 * Must never cost somebody their check-in: the caller uploads the unstamped
 * photo if this throws.
 */

/** "02/11/2026 · 09:42 AM" - the dd/mm/yyyy the rest of the clinic uses. */
export function stampCaption(at: Date): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const h24 = at.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${p2(at.getDate())}/${p2(at.getMonth() + 1)}/${at.getFullYear()} · ${p2(h12)}:${p2(at.getMinutes())} ${ampm}`;
}

/**
 * Type size for the caption, from the image width.
 *
 * Scaled rather than fixed so the band reads the same on a 1280px phone
 * upload as on a small one, with a floor so a very small image is still
 * legible rather than having one-pixel text.
 */
export function captionFontSize(imageWidth: number): number {
  return Math.max(11, Math.round(imageWidth * 0.032));
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode image for stamping")); };
    img.src = url;
  });
}

/**
 * Returns a new JPEG with the time drawn across the bottom.
 *
 * A flat dark panel rather than a gradient: it stays readable over a bright
 * window behind somebody and over a dim corridor, and a clinic doorway is
 * usually one or the other.
 */
export async function stampTime(blob: Blob, at: Date = new Date()): Promise<Blob> {
  const img = await loadImage(blob);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("Image has no dimensions");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.drawImage(img, 0, 0, w, h);

  const base = captionFontSize(w);
  const pad = Math.round(base * 0.6);
  const bandH = pad * 2 + base;
  const bandY = h - bandH;

  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fillRect(0, bandY, w, bandH);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  // Belt and braces for a blown-out background, where the panel alone still
  // leaves white text looking washed out.
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = Math.max(2, Math.round(base * 0.18));
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${base}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(stampCaption(at), pad, bandY + pad);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("Stamped encode failed"))),
      "image/jpeg",
      // Higher than the capture's own compression: the caption is fine text on
      // a flat panel, which is exactly what low JPEG quality smears.
      0.85,
    );
  });
}

/**
 * Stamp it, or hand back what we were given.
 *
 * Every caller wants this rather than stampTime directly. A caption is worth
 * having; it is not worth refusing somebody's attendance over.
 */
export async function stampTimeOrOriginal(blob: Blob, at: Date = new Date()): Promise<Blob> {
  try {
    return await stampTime(blob, at);
  } catch {
    return blob;
  }
}
