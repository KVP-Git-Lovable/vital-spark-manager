import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const clearPreviewServiceWorkerCache = () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const isLovablePreview = window.location.hostname.includes("lovableproject.com") || window.location.hostname.includes("id-preview--");
  if (!isLovablePreview) return;

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });

  if ("caches" in window) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
  }
};

clearPreviewServiceWorkerCache();

createRoot(document.getElementById("root")!).render(<App />);
