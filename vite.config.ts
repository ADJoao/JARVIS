import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' para funcionar tanto no APK (Capacitor) quanto em GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
