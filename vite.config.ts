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
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // NOTA: 'html' RIMOSSO dal precache — altrimenti Workbox serviva
        // index.html dal cache anche dopo nuovi deploy, intrappolando gli
        // utenti in build vecchie. Ora l'HTML passa sempre dalla rete
        // tramite il runtimeCaching NetworkFirst qui sotto.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2,webmanifest}'],
        globIgnores: ['**/og-image.png', '**/splash/**', '**/index.html'],
        cleanupOutdatedCaches: true,
        // Force immediate activation of new SW on every deploy — fixes stale cache
        // issues where users had to close all tabs to see new versions.
        skipWaiting: true,
        clientsClaim: true,
        // navigateFallback usa offline.html SOLO quando la rete fallisce.
        // MAI index.html come fallback: vanificherebbe il fix sopra.
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api/, /^\/supabase/, /^\/~oauth/, /\.\w+$/],
        runtimeCaching: [
          {
            // Auth endpoints — never cache tokens/credentials
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 30,
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            // Navigation requests (HTML documents) — always fresh from
            // network. Browser cache-control no-cache garantisce che
            // ogni navigazione serva il deploy corrente, non il vecchio.
            // Senza questa regola, il precache di Workbox intrappola gli
            // utenti su index.html vecchio anche dopo nuovi deploy.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60, // 1h max
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Forfettino',
        short_name: 'Forfettino',
        description: 'Gestionale per il Regime Forfettario',
        lang: 'it',
        theme_color: '#0d9488',
        background_color: '#f1f5f9',
        display: 'standalone',
        scope: '/',
        start_url: '/dashboard',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent duplicate React instances
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  // Env vars must be provided via .env / build environment — see .env.example.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ""),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""),
    'import.meta.env.VITE_POSTHOG_KEY': JSON.stringify(process.env.VITE_POSTHOG_KEY || ""),
    'import.meta.env.VITE_POSTHOG_HOST': JSON.stringify(process.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com"),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-motion': ['framer-motion'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-date': ['date-fns'],
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-toast',
            '@radix-ui/react-accordion',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
            '@radix-ui/react-slot',
          ],
        },
      },
    },
  },
}));
