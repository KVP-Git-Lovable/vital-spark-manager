/**
 * Which list view a module opens on.
 *
 * Pinning and remembering were two mechanisms and the wrong one won. Pinning
 * wrote is_default to the database; opening the page read the last view
 * clicked, out of the browser, and consulted the pin only when that was
 * missing or no longer resolved. Since the pin button deliberately does not
 * select the row it pins, a pinned view lost to any earlier click on every
 * remount - and the page remounts on every tab change. Reported three times.
 *
 * The rule itself was never wrong, so it is kept and stated here instead of
 * being buried in an effect: the last thing the person did wins. What changed
 * is that pinning now counts as something they did, so it is remembered too.
 */

import { ALL_VIEW_ID, isStandardViewId } from "./standardViews";

export interface PickableView {
  id: string;
  is_default?: boolean;
  owner_id?: string;
}

export interface PickActiveView {
  /** The remembered id for this user on this browser, if any. */
  stored?: string | null;
  views: PickableView[];
  userId?: string;
}

export interface ActiveViewChoice {
  id: string;
  /** True when `stored` named a view this user can no longer see. */
  forget: boolean;
}

export function pickActiveView({ stored, views, userId }: PickActiveView): ActiveViewChoice {
  if (isStandardViewId(stored)) return { id: stored as string, forget: false };
  if (stored && views.some((v) => v.id === stored)) return { id: stored, forget: false };

  // A remembered id that no longer resolves is forgotten rather than kept for
  // ever. Clinic machines are shared, so it was often another user's private
  // view - it could never resolve for this one, and the page fell back
  // silently on every load.
  const forget = Boolean(stored);

  // Only this user's own pin. Searching every visible view made a colleague's
  // pinned view - shared with everyone - quietly become your landing view.
  const pinned = views.find((v) => v.is_default && v.owner_id === userId);
  return { id: pinned ? pinned.id : ALL_VIEW_ID, forget };
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
