import { differenceInDays } from "date-fns";

/**
 * What counts as a visit, in one place.
 *
 * The app carried four different answers at once: the engagement banner counted
 * every appointment, the patient page counted Completed/Checked-in/In Progress,
 * the engagement function counted Completed/Checked-in, and the database rollup
 * counted Completed. So one patient read 10 visits in one box and 1 in the box
 * directly below it - the 10 being nine bookings, one of them still in the future.
 *
 * A visit is an appointment the patient actually turned up to. A booking that
 * has not happened yet is not a visit.
 */
export const VISIT_STATUSES = ["Completed", "Checked-in", "In Progress"] as const;

export function isVisit(status: string | null | undefined): boolean {
  return (VISIT_STATUSES as readonly string[]).includes(String(status ?? ""));
}

/**
 * Whole days between a patient's last visit and now, or null when they have
 * never been in.
 *
 * Derived on read rather than stored. "Days since" changes every day, so a
 * stored copy is stale the moment it is written - 18,886 of 19,000 patients
 * disagreed with their own last-visit date.
 *
 * Never negative. A visit dated in the future (staff marking an appointment
 * attended ahead of time) means nobody has been in since, which reads as 0 -
 * not the "-32" a plain subtraction produced.
 */
export function daysSinceVisit(lastVisit: string | Date | null | undefined): number | null {
  if (!lastVisit) return null;
  const when = lastVisit instanceof Date ? lastVisit : new Date(lastVisit);
  if (Number.isNaN(when.getTime())) return null;
  return Math.max(0, differenceInDays(new Date(), when));
}
