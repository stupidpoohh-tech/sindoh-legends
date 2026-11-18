import { defineConfig } from 'vite';

// base: './' → 어떤 하위 경로(예: https://example.com/sindoh/)에 올려도 동작하는 정적 빌드
// EDITION: 'public'(기본, 포트폴리오) | 'private'(선물 버전, 영상 API 사용) — Pages 환경 변수로 지정
const EDITION = process.env.EDITION === 'private' ? 'private' : 'public';

export default defineConfig({
  base: './',
  define: { __EDITION__: JSON.stringify(EDITION) },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
  server: { host: true },
});
