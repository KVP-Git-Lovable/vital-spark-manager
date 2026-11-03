/**
 * Burn the time and place into an attendance photo.
 *
 * Both are in the database too, but that only travels with the record. Once a
 * check-in photo is downloaded, forwarded or pasted into a report it is just
 * an image, and when and where it was taken is gone. Drawing it into the
 * pixels keeps it attached to the picture, which is the whole reason for
 * asking for a photo at all.
 *
 * Ported from the Bharath Builders app's geoStamp. The first version here was
 * time-only - I judged that a single-site clinic gained nothing from GPS, and
 * the clinic asked for the location, so it is back.
 *
 * Must never cost somebody their check-in: the caller uploads the unstamped
 * photo if this throws.
 */

export interface StampInfo {
  at: Date;
  /** Reverse-geocoded street address, when one resolved. */
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** "03/11/2026 · 09:42 AM" - the dd/mm/yyyy the rest of the clinic uses. */
export function stampCaption(at: Date): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const h24 = at.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${p2(at.getDate())}/${p2(at.getMonth() + 1)}/${at.getFullYear()} · ${p2(h12)}:${p2(at.getMinutes())} ${ampm}`;
}

/** The coordinate line, or "" when there was no fix. */
export function coordLine(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Type size for the caption, from the image width.
 *
 * Scaled rather than fixed so the band reads the same on a 1280px phone
 * upload as on a small one, with a floor so a very small image is still
 * legible rather than having one-pixel text.
 */
export function captionFontSize(imageWidth: number): number {
  return Math.max(11, Math.round(imageWidth * 0.026));
}

/** Greedy word wrap, capped at maxLines with an ellipsis on the last. A full
 *  Nominatim address runs to four lines and would eat a quarter of the photo. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !line) { line = next; continue; }
    lines.push(line);
    line = w;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) {
      let t = last;
      while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
      lines[maxLines - 1] = `${t}…`;
    }
  }
  return lines;
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
 * Returns a new JPEG with the caption drawn across the bottom.
 *
 * A flat dark panel rather than a gradient: it stays readable over a bright
 * window behind somebody and over a dim corridor, and a clinic doorway is
 * usually one or the other.
 */
export async function stampPhoto(blob: Blob, info: StampInfo): Promise<Blob> {
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
  const gap = Math.round(base * 0.34);
  const maxTextW = w - pad * 2;

  ctx.font = `${base}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const addressLines = info.address ? wrap(ctx, info.address, maxTextW, 2) : [];
  const coords = coordLine(info.lat, info.lng);

  // The time is always there; the place is added when it is known. Gating the
  // whole caption on a GPS fix is how the reference ended up with photos
  // carrying no caption at all - not even the time - whenever somebody stood
  // somewhere with no signal.
  const rows = 1 + addressLines.length + (coords ? 1 : 0);
  const bandH = pad * 2 + rows * base + (rows - 1) * gap;
  const bandY = h - bandH;

  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fillRect(0, bandY, w, bandH);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = Math.max(2, Math.round(base * 0.18));
  let y = bandY + pad;

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${base}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(stampCaption(info.at), pad, y);
  y += base + gap;

  ctx.font = `${base}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  for (const line of addressLines) {
    ctx.fillText(line, pad, y);
    y += base + gap;
  }

  if (coords) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.font = `${Math.round(base * 0.85)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(coords, pad, y);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("Stamped encode failed"))),
      "image/jpeg",
      // Higher than the capture's own compression: the caption is fine text
      // on a flat panel, which is exactly what low JPEG quality smears.
      0.85,
    );
  });
}

/**
 * Stamp it, or hand back what we were given.
 *
 * Every caller wants this rather than stampPhoto directly. A caption is worth
 * having; it is not worth refusing somebody's attendance over.
 */
export async function stampPhotoOrOriginal(blob: Blob, info: StampInfo): Promise<Blob> {
  try {
    return await stampPhoto(blob, info);
  } catch {
    return blob;
  }
}
