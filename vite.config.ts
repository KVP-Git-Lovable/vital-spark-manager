import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // "prompt", not "autoUpdate". With autoUpdate the service worker took
      // control and reloaded every open tab the moment a new build shipped -
      // and this app is deployed several times a day, so staff had the page
      // vanish under them mid-form.
      //
      // "prompt" alone went too far the other way: a waiting build was applied
      // only if somebody noticed a toast, and navigations are answered from the
      // old worker's precache, so everyone sat on a stale copy of the app for
      // days with reloading making no difference. registerPwa now applies a
      // build that was already waiting when the page loaded - nothing is typed
      // at that point - and only asks about one that turns up mid-session.
      registerType: "prompt",
      injectRegister: null,
      devOptions: { enabled: false },
      includeAssets: ["favicon.png", "skin-clinic-logo.png", "apple-touch-icon.png"],
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/~oauth/],
        // Take over open tabs as soon as the new worker activates. skipWaiting
        // stays off deliberately - that is what keeps an update from imposing
        // itself on someone mid-form - but once it has been applied there is no
        // reason to make them navigate again before it takes effect.
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "skin-clinic-pages" },
          },
          {
            urlPattern: ({ request }) =>
              ["script", "style", "font", "image"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "skin-clinic-assets",
              // Without this the cache kept every superseded chunk for ever, so
              // a long-lived browser hoarded old builds it could never use.
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: "The Skin Clinic",
        short_name: "Skin Clinic",
        description: "Clinic management made simple",
        theme_color: "#1e293b",
        background_color: "#f5f7fa",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
}));
