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
      // vanish under them mid-form. registerPwa now offers a Reload button
      // instead and lets them finish what they were doing first.
      registerType: "prompt",
      injectRegister: null,
      devOptions: { enabled: false },
      includeAssets: ["favicon.png", "skin-clinic-logo.png", "apple-touch-icon.png"],
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/~oauth/],
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
            options: { cacheName: "skin-clinic-assets" },
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
