import { supabase } from "@/integrations/supabase/client";

/**
 * Whether a visit can still be filed against the appointment it was opened from.
 *
 * procedures.appointment_id is a foreign key onto appointments, and the front
 * desk deletes appointments constantly - twenty in three days. Open a visit
 * from an appointment, have that appointment deleted while the consultation is
 * being written up, press Save, and the whole thing is rejected:
 *
 *   insert or update on table "procedures" violates foreign key constraint
 *   "procedures_appointment_id_fkey"
 *
 * which is what the clinic hit at 13:08 on 20 Oct, the same minute an
 * appointment was deleted. The doctor loses everything typed, over a link to a
 * record that no longer exists.
 *
 * So a link to an appointment that has gone is dropped and the visit saved
 * against the patient instead. That is not a compromise: the foreign key is
 * ON DELETE SET NULL, so a procedure whose appointment is deleted a second
 * later ends up with exactly this - no appointment, patient intact. Saving it
 * that way reaches the same state the database would have reached on its own,
 * and the clinical record survives.
 */

export interface AppointmentLink {
  /** What to write to procedures.appointment_id. */
  id: string | null;
  /** True when a real appointment was named and has since been deleted. */
  removed: boolean;
}

export function decideAppointmentLink(
  appointmentId: string | null | undefined,
  appointmentExists: boolean,
): AppointmentLink {
  const id = (appointmentId ?? "").trim();
  // No appointment named: a walk-in, or a visit opened from the patient. There
  // was never a link and nothing has been lost.
  if (!id) return { id: null, removed: false };
  return appointmentExists ? { id, removed: false } : { id: null, removed: true };
}

/** Said once, so the front desk knows why the visit is not under the appointment. */
export const APPOINTMENT_REMOVED_NOTICE =
  "That appointment has been deleted, so this visit was saved against the patient without it.";

/**
 * The same decision, after asking the database whether the appointment is
 * still there. Called immediately before the write, so the answer is as fresh
 * as it can be - a deletion in the moments after this is what ON DELETE SET
 * NULL is for.
 */
export async function appointmentLinkForSave(
  appointmentId: string | null | undefined,
): Promise<AppointmentLink> {
  const id = (appointmentId ?? "").trim();
  if (!id) return { id: null, removed: false };
  const { data, error } = await supabase.from("appointments").select("id").eq("id", id).maybeSingle();
  // A lookup that failed for its own reasons (offline, a transient error) must
  // not throw the link away - the insert is the better judge then, and it is
  // the case the foreign key already handles correctly.
  if (error) return { id, removed: false };
  return decideAppointmentLink(id, Boolean(data));
}
