
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild', // Menggunakan esbuild yang lebih cepat dan bawaan Vite
    chunkSizeWarningLimit: 1600,
  }
});
