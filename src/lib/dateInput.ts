/**
 * Date of Birth is read and typed as dd/MM/yyyy on every machine.
 *
 * A native `<input type="date">` is painted by the browser in that computer's
 * own region setting, so one clinic PC shows a patient as 07/31/1982 and the
 * next shows 31/07/1982. No CSS or app code can change that, so the field is a
 * plain text box instead and these functions bridge it to the ISO yyyy-MM-dd
 * the database stores.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const DISPLAY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** ISO (or anything unparseable, including "") -> "31/07/1982" or "". */
export function isoToDisplay(iso: string | null | undefined): string {
  const m = ISO.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "31/07/1982" -> "1982-07-31". null when incomplete or not a real date. */
export function displayToIso(text: string | null | undefined): string | null {
  const m = DISPLAY.exec((text ?? "").trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  // new Date(1982, 1, 31) silently becomes 3 March, so a date only counts as
  // real if it comes back out carrying the same three parts it went in with.
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Drops the separators in as the user types, so they enter digits only.
 * Works backwards too: deleting is just as much a smaller digit string.
 */
export function maskTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
