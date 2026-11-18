import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// base: './' → 어떤 하위 경로(예: https://example.com/sindoh/)에 올려도 동작하는 정적 빌드
// EDITION: 'public'(기본, 포트폴리오) | 'private'(선물 버전, 영상 API 사용) — Pages 환경 변수로 지정
const EDITION = process.env.EDITION === 'private' ? 'private' : 'public';

export default defineConfig({
  base: './',
  define: { __EDITION__: JSON.stringify(EDITION) },
  // 판별 콘텐츠(영상 목록·엔딩 문구): content/public 또는 content/private 중 하나만 번들에 포함
  resolve: { alias: { '@content': fileURLToPath(new URL(`./content/${EDITION}`, import.meta.url)) } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
  server: { host: true },
});
