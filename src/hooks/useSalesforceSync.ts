import { useSyncExternalStore } from "react";
import { subscribeSync, getSyncState, startSync, stopSync } from "@/lib/salesforceSyncStore";

export function useSalesforceSync() {
  const state = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
  return { ...state, startSync, stopSync };
}
