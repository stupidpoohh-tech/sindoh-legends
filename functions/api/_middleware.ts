import { configured, Env } from '../_lib/auth';

/**
 * PUBLIC(포트폴리오) 배포에서는 /api/* 전체를 404 로 처리 — 영상 API 가 존재하지 않는 것처럼 동작.
 * PRIVATE 배포(EDITION=private + GIFT_CODE + SESSION_SECRET 설정)에서만 다음 핸들러로 진행.
 */
export const onRequest = async (ctx: { request: Request; env: Env; next: () => Promise<Response> }) => {
  if (!configured(ctx.env)) return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const res = await ctx.next();
  const h = new Headers(res.headers);
  h.set('X-Robots-Tag', 'noindex, nofollow');
  h.set('X-Content-Type-Options', 'nosniff');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};
