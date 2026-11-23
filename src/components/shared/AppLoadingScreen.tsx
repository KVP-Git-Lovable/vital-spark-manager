import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shown while the app checks who is signed in, instead of nothing.
 *
 * These guards used to render `null`. React replaces the boot shell in
 * index.html the instant it mounts, so from then on a sign-in check or staff
 * lookup that never answered - a phone waking on a bad connection, a request
 * that stalls - left a plain white page for ever, with nothing to tap. That
 * is the "blank screen" staff kept reporting from Chrome and the installed
 * app, and the boot shell's own timer could not help because it was gone.
 *
 * Looks like the boot shell so the hand-over is seamless, and after
 * SLOW_LOADING_MS says so and offers a Reload. Reload only reloads the page:
 * clearing stored copies belongs to the boot shell and lazyWithReload, not to
 * a running app (see registerPwa.ts).
 */
export const SLOW_LOADING_MS = 10_000;

export function AppLoadingScreen({ slowAfterMs = SLOW_LOADING_MS }: { slowAfterMs?: number }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(timer);
  }, [slowAfterMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-background p-6 text-center"
    >
      <img src="/pwa-192.png" alt="" width={56} height={56} className="rounded-xl" />
      <p className="m-0 text-[15px] text-muted-foreground">
        {slow
          ? "This is taking longer than usual. Check your connection and try again."
          : "Loading The Skin Clinic…"}
      </p>
      {slow && (
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
      )}
    </div>
  );
}

export default AppLoadingScreen;
