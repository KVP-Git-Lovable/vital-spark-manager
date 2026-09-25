import { UPDATE_CHECK_INTERVAL_MS, updateActionFor } from "@/lib/pwaUpdate";

const APP_SERVICE_WORKER_PATH = "/sw.js";

const isPreviewHost = (hostname: string) =>
  hostname.startsWith("id-preview--") ||
  hostname.startsWith("preview--") ||
  hostname === "lovableproject.com" ||
  hostname.endsWith(".lovableproject.com") ||
  hostname === "lovableproject-dev.com" ||
  hostname.endsWith(".lovableproject-dev.com") ||
  hostname === "beta.lovable.dev" ||
  hostname.endsWith(".beta.lovable.dev");

const removeAppServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => new URL(registration.active?.scriptURL ?? APP_SERVICE_WORKER_PATH, location.origin).pathname === APP_SERVICE_WORKER_PATH)
      .map((registration) => registration.unregister()),
  );
};

// A build is waiting and someone has to decide. Kept here rather than in React
// state because registration happens before the app mounts, and the header
// needs to be able to show it whenever it does.
let updateWaiting = false;
const waitingListeners = new Set<(waiting: boolean) => void>();
let applyUpdate: (() => void) | null = null;

const setUpdateWaiting = (waiting: boolean) => {
  updateWaiting = waiting;
  waitingListeners.forEach((listener) => listener(waiting));
};

/** Subscribe to "a new build is waiting to be applied". Fires immediately with the current state. */
export const subscribeToAppUpdate = (listener: (waiting: boolean) => void) => {
  waitingListeners.add(listener);
  listener(updateWaiting);
  return () => {
    waitingListeners.delete(listener);
  };
};

/** Apply the waiting build and reload. Safe to call when nothing is waiting. */
export const applyAppUpdate = () => applyUpdate?.();

export const registerPwa = async () => {
  if (!("serviceWorker" in navigator)) return;

  const shouldDisable =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    isPreviewHost(window.location.hostname) ||
    new URLSearchParams(window.location.search).get("sw") === "off";

  if (shouldDisable) {
    await removeAppServiceWorker();
    return;
  }

  const { registerSW } = await import("virtual:pwa-register");

  const registeredAt = Date.now();

  // The update is applied when it costs nothing and offered when it might.
  //
  // This used to be registerType "autoUpdate", which reloaded every open tab as
  // soon as a build was published - the page disappearing mid-consultation.
  // Asking first fixed that and created a worse problem: navigations are served
  // from the old worker's precache, so a build nobody clicked through to was
  // never applied, and no amount of reloading helped. Whole days of fixes sat
  // undelivered.
  //
  // So: a build already waiting when we register arrived with the page, before
  // anything was typed, and goes in silently - which is what makes a stale
  // install recover on the next reload. One that turns up later waits to be
  // asked, through a toast and a control in the header that does not disappear.
  const updateSW = registerSW({
    immediate: true,

    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      // Without this an always-open tab never asks whether a newer build exists
      // - registration is the only check there used to be - so a browser left
      // open all day stayed on the build it started with.
      const checkForUpdate = () => {
        if (!navigator.onLine) return;
        registration.update().catch(() => {
          // Offline, or the server is briefly unreachable. The next check will do.
        });
      };

      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
    },

    async onNeedRefresh() {
      // Deferred a tick because this can fire while registerSW is still
      // returning, before updateSW is assigned.
      const reload = () => setTimeout(() => void updateSW(true), 0);

      if (updateActionFor(Date.now() - registeredAt) === "apply") {
        reload();
        return;
      }

      applyUpdate = reload;
      setUpdateWaiting(true);

      const { toast } = await import("sonner");
      toast("A new version of the app is ready", {
        description: "Reload when you have finished what you are doing.",
        duration: Infinity,
        action: { label: "Reload", onClick: reload },
      });
    },
  });
};
