/**
 * Which list view a module opens on.
 *
 * Two mechanisms, and for a long time the wrong one won. Pinning wrote
 * is_default to the database; opening the page read the last view clicked, out
 * of the browser, and consulted the pin only when that was missing. Since the
 * pin button deliberately does not select the row it pins, a pinned view lost
 * to any earlier click on every remount - and the page remounts on every tab
 * change.
 *
 * Worse, is_default was a single column on a row that may be shared with the
 * whole clinic, so it was never one person's answer: the front desk opened the
 * menu, found a colleague's pinned view already flagged, and pressed the pin -
 * which the UI read as "unpin" and which moved them to All Appointments. The
 * pin now lives in list_view_defaults, one row per person per module, and
 * `pinned` here is that person's own.
 *
 * The rule, stated once rather than buried in an effect:
 *
 *   1. what you were last looking at in this session, if it still resolves;
 *   2. otherwise your pin, which is why opening the app fresh lands there;
 *   3. otherwise All.
 *
 * Step 1 is remembered per session (sessionStorage), not for ever: moving
 * between modules and reloading the tab keeps your place, while opening the
 * app tomorrow starts from the pin. A pin that always lost to a click made
 * weeks earlier was not a pin.
 */

import { ALL_VIEW_ID, isStandardViewId } from "./standardViews";

export interface PickableView {
  id: string;
}

export interface PickActiveView {
  /** The id remembered for this session on this browser, if any. */
  stored?: string | null;
  /** This user's own pinned view id, from list_view_defaults. */
  pinned?: string | null;
  views: PickableView[];
}

export interface ActiveViewChoice {
  id: string;
  /** True when `stored` named a view this user can no longer see. */
  forget: boolean;
}

const resolves = (id: string | null | undefined, views: PickableView[]): boolean =>
  isStandardViewId(id) || (!!id && views.some((v) => v.id === id));

export function pickActiveView({ stored, pinned, views }: PickActiveView): ActiveViewChoice {
  if (resolves(stored, views)) return { id: stored as string, forget: false };

  // A remembered id that no longer resolves is forgotten rather than kept for
  // ever. Clinic machines are shared, so it was often another user's private
  // view - it could never resolve for this one, and the page fell back
  // silently on every load.
  const forget = Boolean(stored);

  // A pin may name a view somebody else owns and shared, which is the usual
  // case here: the clinic's landing view was created by one person for all of
  // them. It may also name a deleted view, and then there is nothing to go to.
  if (resolves(pinned, views)) return { id: pinned as string, forget };

  return { id: ALL_VIEW_ID, forget };
}

/**
 * Where the remembered view is kept.
 *
 * Per user, not per browser. The front desk machine is shared and the key
 * carried no user id, so whatever the last person was looking at is what the
 * next person's page restored - and under a doctor's own-records scope that
 * can mean a list filtered to somebody else's patients, which comes back
 * empty.
 */
export const activeViewKey = (section: string, userId?: string): string =>
  userId ? `${section}.activeListView.${userId}` : `${section}.activeListView`;
