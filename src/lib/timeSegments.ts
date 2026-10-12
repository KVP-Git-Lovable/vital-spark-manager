/**
 * Hour and minute are two halves of one time, not two independent boxes.
 *
 * The clinic reported two faults with the appointment time field, and both
 * came from treating them separately. Backspacing the hour emptied the whole
 * time - the minutes went with it - and the half-typed value that reached the
 * screen ("2026-10-12T" with nothing after the T) was passed to a Date, which
 * threw "Invalid time value" and took the screen down. Typing the hour also
 * left the caret where it was, so staff had to reach for the mouse to enter
 * the minutes.
 *
 * These are the rules behind the two boxes. The component keeps the focus and
 * the state; what a keystroke means lives here, where it can be tested.
 */

/**
 * Should the caret move on to the minutes after these hour digits?
 *
 * Two digits is a finished hour. One digit finishes it too when nothing could
 * follow it: on a twelve-hour clock only 1 can start a two-digit hour (10, 11,
 * 12), so 2 to 9 are already the whole answer. A lone 0 waits - the person is
 * on their way to 09.
 */
export function hourAdvances(digits: string): boolean {
  if (digits.length >= 2) return true;
  if (digits.length !== 1) return false;
  const n = Number(digits);
  return n >= 2 && n <= 9;
}

/**
 * Is the whole time being cleared, or just one half being retyped?
 *
 * Only an empty field on both sides means "no time" - which is what an
 * optional time, such as a clinic break, is cleared by. One box emptied on
 * its way to new digits must leave the other alone.
 */
export function clearsWholeTime(hourDigits: string, minuteDigits: string): boolean {
  return hourDigits.trim() === "" && minuteDigits.trim() === "";
}
