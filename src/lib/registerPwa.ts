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

  // The update is offered, not imposed. This used to be registerType
  // "autoUpdate", which reloads every open tab as soon as a new build is
  // published; with several deploys a day that meant the page disappearing
  // mid-consultation, which staff reported as "the app refreshes suddenly".
  //
  // The toast has no timeout and cannot be dismissed by accident: whoever is
  // mid-way through a form finishes it and reloads when they are ready. A stale
  // tab is still safe - lazyWithReload recovers if an old chunk has gone.
  const updateSW = registerSW({
    immediate: true,
    async onNeedRefresh() {
      const { toast } = await import("sonner");
      toast("A new version of the app is ready", {
        description: "Reload when you have finished what you are doing.",
        duration: Infinity,
        action: { label: "Reload", onClick: () => updateSW(true) },
      });
    },
  });
};