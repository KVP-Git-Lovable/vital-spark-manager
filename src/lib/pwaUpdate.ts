/**
 * When a new build is waiting, do we apply it or ask first?
 *
 * The app used to update itself the instant a build was published, which meant
 * the page vanishing mid-consultation - reported as "the app gets refreshed
 * suddenly". The cure was to ask first, and it went too far the other way: a
 * waiting build was applied only if someone noticed a toast and clicked it, so
 * everyone quietly sat on an old copy of the app for days.
 *
 * The rule that gives both: apply it at a moment when there is nothing to lose,
 * and ask only when there is. A build already waiting when the page registers
 * its worker is safe - the person has just arrived and has typed nothing - so it
 * goes in silently. One that turns up later could interrupt real work, so that
 * one waits to be asked.
 *
 * This is what makes a stale install recoverable: any reload, or reopening the
 * app, now picks up whatever is waiting instead of serving yesterday's bundle
 * back forever.
 */

/** How long after registering a waiting build still counts as "arrived with the page". */
export const UPDATE_AT_LOAD_GRACE_MS = 10_000;

/** How often an open tab asks whether a newer build has been published. */
export const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export type UpdateAction = "apply" | "ask";

export const updateActionFor = (msSinceRegistered: number): UpdateAction =>
  msSinceRegistered <= UPDATE_AT_LOAD_GRACE_MS ? "apply" : "ask";

/**
 * Coming back to the app after being away is also a fresh start.
 *
 * "ask" above has nobody to ask: the clinic had the toast and the header
 * button removed after a build applied itself mid-consultation, so a build
 * arriving while the app is open simply waits for the next load. On a desktop
 * that is survivable - browsers get closed, pages get reloaded. On a phone the
 * app is never closed, only backgrounded, so "ask" came to mean "never" on the
 * device the clinic uses most. Three faults were reported in a week that were
 * really one phone or one tab running last week's code.
 *
 * Returning to a page somebody put down is the same safe moment as arriving:
 * nothing has been typed, nothing is half-finished. So the build goes in then,
 * and only then.
 */

/** Hidden for less than this is a glance at a notification, not an absence. */
export const AWAY_MS = 60_000;

/**
 * What "somebody is in the middle of something" looks like in the DOM.
 *
 * [role="dialog"] was the whole test, and it covered every form in the app
 * except the one that mattered most. The procedure form is also the New
 * Prescription route, and that route renders it with asPage - a plain <div>,
 * no Dialog, so no dialog role. A prescription written from /procedures/new
 * was therefore invisible to this check, while the very same form opened as a
 * modal from an appointment was protected. The page could reload itself out
 * from under a half-written prescription: two minutes untouched is normal
 * while talking to the patient, and a prescription composed from the product
 * dropdowns puts nothing in an input for somethingIsTyped() to find.
 *
 * [data-work-in-progress] is how a full-page form says the same thing a
 * dialog says by existing. It stays a read off the page rather than state
 * threaded through the app, for the reason the busy checks were written that
 * way to begin with: the form that forgot to report itself would be the one
 * that lost somebody's work.
 */
export const WORK_IN_PROGRESS_SELECTOR = '[role="dialog"], [data-work-in-progress]';

/** Whether anything on the page is a form somebody is in the middle of. */
export const workIsInProgress = (doc: Pick<Document, "querySelector">): boolean =>
  Boolean(doc.querySelector(WORK_IN_PROGRESS_SELECTOR));

export interface ReturnContext {
  /** How long the app was in the background. */
  hiddenForMs: number;
  /** A form somebody is in the middle of - a dialog, or a full-page form. */
  dialogOpen: boolean;
  /** Something has been typed and not saved. */
  hasTypedContent: boolean;
}

export const shouldApplyOnReturn = ({ hiddenForMs, dialogOpen, hasTypedContent }: ReturnContext): boolean =>
  hiddenForMs >= AWAY_MS && !dialogOpen && !hasTypedContent;
