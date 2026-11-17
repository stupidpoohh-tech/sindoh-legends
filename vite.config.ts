import { defineConfig } from 'vite';

// base: './' → 어떤 하위 경로(예: https://example.com/sindoh/)에 올려도 동작하는 정적 빌드
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
  server: { host: true },
});
