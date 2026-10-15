/**
 * Which conversations have something the clinic has not read.
 *
 * The list already showed a "Waiting" chip whenever the last message came in,
 * which front desk reasonably read as "unread" - and it is not. It stayed on a
 * thread somebody had answered by phone an hour earlier, and said nothing
 * about what had arrived since. So they opened every conversation to find out
 * whether a patient had replied.
 *
 * Unread is about two things together: the last word was the patient's, and it
 * arrived after this person last opened the thread.
 */

export interface UnreadThread {
  phone: string;
  /** When the most recent message in the thread arrived. */
  last_at: string;
  /** "inbound" when the patient wrote it. */
  last_direction?: string | null;
}

/**
 * @param lastReadAt when this person last opened the thread, or null if never.
 */
export function isThreadUnread(thread: UnreadThread, lastReadAt: string | null | undefined): boolean {
  // The clinic's own reply is never unread, whoever sent it and whenever.
  if ((thread.last_direction ?? "").toLowerCase() !== "inbound") return false;

  const arrived = Date.parse(thread.last_at ?? "");
  // An unparseable date is not worth a mark nobody can clear.
  if (Number.isNaN(arrived)) return false;

  if (!lastReadAt) return true;
  const read = Date.parse(lastReadAt);
  if (Number.isNaN(read)) return true;

  return arrived > read;
}

/** For the count beside the Conversations tab. */
export function unreadCount(
  threads: UnreadThread[],
  readsByPhone: Record<string, string | undefined>,
): number {
  return threads.reduce((n, thread) => (isThreadUnread(thread, readsByPhone[thread.phone]) ? n + 1 : n), 0);
}
