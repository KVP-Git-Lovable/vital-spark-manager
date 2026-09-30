/**
 * Is this appointment's "service" really its Investigation text?
 *
 * Doctors reported investigations turning up in the Services list of a
 * prescription. They come from the visit: the New Prescription form seeds its
 * first service line from the appointment's service, and on a great many
 * appointments that column holds the visit's Investigation rather than a
 * treatment - "2Rx Revlite laser toning for fine hair (Face) last session on
 * 27/2/2026 + 4rx Bikini Hair Reduction last session on 1/4/2026" is a history,
 * not a service, and no doctor chose it.
 *
 * The test is whether the service text appears inside the visit's Investigation.
 * That is what tells the two apart, and it has to be this rather than "is it in
 * the Service Master", because over the last 90 days 485 appointments name a
 * real master service that also appears in a longer Investigation ("HYDRA CLEAN
 * UP" inside "HYDRA CLEAN UP + 2rx peel") and those must keep pre-filling. They
 * still do: the form matches the seed against the Service Master as soon as it
 * loads, which fills the line properly, with its id, notes and price.
 *
 * So this only suppresses the first, unmatched guess - 279 appointments in the
 * same period, 264 of them where the service column is the Investigation word
 * for word. Nothing is written or corrected; the appointment keeps whatever it
 * holds.
 */

const flatten = (value: string | null | undefined) =>
  (value || "").toLowerCase().replace(/\s+/g, " ").trim();

export function looksLikeInvestigation(
  service: string | null | undefined,
  investigation: string | null | undefined,
): boolean {
  const name = flatten(service);
  const reason = flatten(investigation);
  if (!name || !reason) return false;
  return reason.includes(name);
}
