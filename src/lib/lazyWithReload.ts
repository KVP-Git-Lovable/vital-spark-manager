import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-at";

/**
 * Route-level lazy() that survives stale chunk hashes after a new deploy.
 * If the dynamic import fails (old index.html pointing at removed assets),
 * retry once, then hard-reload the page (at most once per minute) so the
 * browser fetches the fresh asset manifest instead of showing a blank screen.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      try {
        return await factory();
      } catch {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          // Never resolves; the reload takes over.
          return await new Promise<{ default: T }>(() => {});
        }
        throw err;
      }
    }
  });
}
