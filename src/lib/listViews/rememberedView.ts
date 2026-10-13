/**
 * The view you were last looking at, remembered for this session only.
 *
 * sessionStorage, not localStorage: it survives moving between modules and
 * reloading the tab, which is what "take me back where I was" means, and it is
 * gone when the app is opened fresh, which is when the pin should decide. Kept
 * in localStorage it outlived everything and quietly defeated the pin for ever
 * - pin "Todays Appointments", click All Appointments once weeks ago, and the
 * click still won.
 *
 * Either store can throw (privacy mode, a sandboxed frame), so neither is
 * trusted with anything the page needs in order to work.
 */

export function readRemembered(key: string): string | null {
  let value: string | null = null;
  try {
    value = sessionStorage.getItem(key);
  } catch {
    /* best effort */
  }
  try {
    // One-time tidy-up of the key this used to be written to. Leaving it would
    // do no harm, but it is the value that used to beat the pin.
    localStorage.removeItem(key);
  } catch {
    /* best effort */
  }
  return value;
}

export function writeRemembered(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* best effort */
  }
}
