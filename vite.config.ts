import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// The Android app is served from https://localhost inside the WebView, so API calls need an absolute URL.
// `vite build --mode android` (npm run build:android) bakes in the production Cloud Run URL unless
// VITE_API_URL is set explicitly. Not a secret; it's the public service URL.
const ANDROID_API_URL = 'https://kova-gkgwmqurbq-ew.a.run.app';

export default defineConfig(({ mode }) => {
  if (mode === 'android' && !process.env.VITE_API_URL) {
    process.env.VITE_API_URL = ANDROID_API_URL;
  }
  return {
    base: './', // Ensures relative path resolution in Android WebView assets
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    optimizeDeps: {
      // Only scan the real app. Without this, Vite also crawls the built copy that `cap sync` puts in
      // android/app/src/main/assets/public and fails on its bundled imports.
      entries: ['index.html'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/android/**', '**/dist/**'] },
    },
  };
});
