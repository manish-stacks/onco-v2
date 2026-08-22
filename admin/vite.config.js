import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // recharts is heavy — keep it in its own chunk so the first load stays light
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      // Avoids CORS in dev — /api goes straight to the backend.
      //
      // This used to default to the remote beta server, which meant `npm run dev`
      // silently tested against production code instead of the backend running
      // locally on :4000. Local is the default now; point VITE_API_PROXY at beta
      // only when you actually want to hit it.
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
