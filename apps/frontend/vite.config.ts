import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Vite only exposes VITE_-prefixed env vars to the browser bundle.
  // Never add VITE_SUPABASE_SERVICE_ROLE_KEY — see SEC-04.
});
