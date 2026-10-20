/**
 * Reading a realtime change to an appointment, and saying what it means.
 *
 * The front desk re-books by creating the new slot and deleting the old one -
 * twenty-five seconds apart, in the case that cost a consultation. The doctor
 * was writing up the old appointment and had no way to know, because the app
 * holds its data for a minute and was deliberately stopped from refetching on
 * window focus (that was "the app refreshes by itself"). So the change has to
 * come to her instead of being discovered at Save.
 *
 * The parsing lives here, away from the subscription, because a payload off
 * the wire is the thing most worth being careful with: an insert and an update
 * carry the row in `new`, a delete carries only its key in `old`, and anything
 * that does not look like either is ignored rather than guessed at.
 */

export type AppointmentChange = "changed" | "deleted";

interface RealtimePayloadish {
  eventType?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
}

const idOf = (row: Record<string, unknown> | null | undefined): string | null => {
  const id = row?.id;
  return typeof id === "string" && id.trim() ? id : null;
};

/** Which appointment a change was about, or null when it cannot be told. */
export function appointmentEventId(payload: RealtimePayloadish | null | undefined): string | null {
  if (!payload) return null;
  // A delete sends the key in `old` and nothing in `new`. Everything else
  // carries the row itself.
  return idOf(payload.new) ?? idOf(payload.old);
}

/** Deletions are the ones that matter to an open record; the rest are changes. */
export function appointmentChangeKind(payload: RealtimePayloadish | null | undefined): AppointmentChange {
  return (payload?.eventType ?? "").toUpperCase() === "DELETE" ? "deleted" : "changed";
}

/**
 * What to put at the top of an appointment somebody has open.
 *
 * Said plainly, and for a deletion said together with the reassurance, because
 * the question it raises - "have I just lost what I typed?" - has an answer
 * now: the visit saves against the patient instead. See procedureAppointment.ts.
 */
export function openAppointmentNotice(kind: AppointmentChange): string {
  return kind === "deleted"
    ? "This appointment has been deleted at the front desk. Anything you save will be kept on the patient's record."
    : "This appointment was changed at the front desk.";
}
