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
        // Only precache critical assets - lazy chunks will be cached at runtime
        globPatterns: [
          'index.html',
          'assets/index-*.{js,css}', // Main app bundle and styles
          'assets/tidal-logo-*.png', // App logo
        ],
        globIgnores: [
          '**/node_modules/**/*',
          'sw.js',
          'workbox-*.js',
          'assets/*-vendor*.js', // Exclude all vendor chunks (lazy loaded)
          'assets/*-*.js', // Exclude other lazy chunks except index
          'assets/html2canvas*', // Large library, lazy loaded
          'assets/purify*', // Lazy loaded
        ],
        maximumFileSizeToCacheInBytes: 500 * 1024 // 500 KB limit for critical assets only
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
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React and routing
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // Radix UI components - split for better caching
          'radix-ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],

          // Data visualization
          'chart-vendor': ['recharts'],

          // Form handling and validation
          'form-vendor': ['react-hook-form', 'zod', '@hookform/resolvers'],

          // Backend and state management
          'supabase-vendor': ['@supabase/supabase-js', '@tanstack/react-query'],

          // Utilities and styling
          'utils-vendor': [
            'date-fns',
            'lucide-react',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'next-themes',
          ],

          // UI and interaction libraries
          'ui-vendor': [
            'react-big-calendar',
            'react-day-picker',
            'sonner',
            'embla-carousel-react',
            'react-qr-code',
            'react-resizable-panels',
            'vaul',
            'cmdk',
            'input-otp',
          ],

          // Animation and gestures
          'animation-vendor': [
            '@react-spring/web',
            '@use-gesture/react',
            'tailwindcss-animate',
          ],
        },
      },
    },
  },
}));
