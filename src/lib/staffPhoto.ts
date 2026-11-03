import { supabase } from "@/integrations/supabase/client";

/**
 * Saving the photo a staff member's attendance selfie is checked against.
 *
 * Lives here rather than in a component because two screens now need it: the
 * profile page, where somebody sets it deliberately, and the attendance page,
 * where somebody who has not set one registers their face and carries
 * straight on into starting their day. Two copies of an upload that writes to
 * storage AND a column is two chances for them to drift apart.
 */

/** A year: this URL is read by the face verifier on every single check-in,
 *  so a short expiry would mean re-signing it constantly. */
const SIGNED_FOR = 60 * 60 * 24 * 365;

const KNOWN_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

/** `<staffId>/profile-<timestamp>.<ext>` — the first segment is the staff id
 *  because the bucket policy only lets somebody write inside their own
 *  folder, so the path IS the permission. Timestamped rather than a fixed
 *  name: one overwritten path is served from cache long after it changed, and
 *  the person would swear the new photo had not saved. */
export function staffPhotoPath(staffId: string, fileName?: string | null, now: number = Date.now()): string {
  const raw = String(fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  const ext = KNOWN_EXT.has(raw) ? raw : "jpg";
  return `${staffId}/profile-${now}.${ext}`;
}

/**
 * Uploads the photo, points staff.photo_url at it, and hands back the URL.
 *
 * Throws on failure - both callers show the message, and a silent failure
 * here would leave somebody unable to check in with no idea why.
 */
export async function uploadStaffPhoto(staffId: string, file: File): Promise<string> {
  const path = staffPhotoPath(staffId, file.name);

  const { error: upErr } = await supabase.storage
    .from("attendance-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (upErr) throw upErr;

  const { data: signed, error: signErr } = await supabase.storage
    .from("attendance-photos")
    .createSignedUrl(path, SIGNED_FOR);
  if (signErr || !signed?.signedUrl) throw signErr || new Error("Could not prepare the photo");

  const { error: saveErr } = await supabase
    .from("staff")
    .update({ photo_url: signed.signedUrl })
    .eq("id", staffId);
  if (saveErr) throw saveErr;

  return signed.signedUrl;
}
