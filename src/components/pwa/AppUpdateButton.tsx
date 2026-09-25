import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyAppUpdate, subscribeToAppUpdate } from "@/lib/registerPwa";

/**
 * "Update ready" in the header, for as long as it is true.
 *
 * The toast that used to be the only way to take an update could be swiped
 * away, and only ever appeared at the moment the update arrived - so anyone who
 * missed it stayed on an old copy of the app with no way of knowing. This sits
 * in the header until the update is applied, and nothing dismisses it.
 *
 * It renders nothing at all in the ordinary case, which is most of the time.
 */
export function AppUpdateButton() {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => subscribeToAppUpdate(setWaiting), []);

  if (!waiting) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={applyAppUpdate}
      className="gap-1.5 border-amber-500/40 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/50"
      title="A new version of the app is ready. Nothing you have saved is affected."
    >
      <RefreshCw className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Update ready</span>
    </Button>
  );
}
