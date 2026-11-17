import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { fs: { strict: true } },
  build: { target: 'esnext', rollupOptions: { output: { manualChunks: { three: ['three'], physics: ['@dimforge/rapier3d-compat'] } } } }
});
