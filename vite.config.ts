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
    hmr: true, // Ensure HMR is enabled
  },
  plugins: [
    react({
      // Configure react plugin for better HMR
      jsxImportSource: undefined, // Use default React JSX runtime
    }),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: 'injectManifest', // Use custom service worker for push event handlers
      srcDir: 'src',
      filename: 'service-worker.ts',
      registerType: 'autoUpdate',
      manifest: false, // Use existing manifest.json in public/
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['**/node_modules/**/*', 'sw.js', 'workbox-*.js'],
        maximumFileSizeToCacheInBytes: 2.5 * 1024 * 1024 // 2.5 MB limit to accommodate main bundle
      },
      devOptions: {
        enabled: true, // Enable SW in dev mode for push notification testing
        type: 'module'
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'], // Pre-bundle React to avoid conflicts
  },
  build: {
    sourcemap: mode === 'development',
  },
}));
