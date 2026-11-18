import { Env, isAuthed, issueCookie, clearCookie, safeEqual, json } from '../_lib/auth';

type Ctx = { request: Request; env: Env };

/** 인증 상태 확인 */
export const onRequestGet = async ({ request, env }: Ctx) => json({ authed: await isAuthed(request, env) });

/** 입장 코드 검증 → 세션 쿠키 발급 */
export const onRequestPost = async ({ request, env }: Ctx) => {
  let code = '';
  try {
    const body = (await request.json()) as { code?: unknown };
    code = typeof body.code === 'string' ? body.code.trim() : '';
  } catch {
    /* 잘못된 본문 */
  }
  if (!code || code.length > 200) return json({ authed: false }, 400);
  const ok = await safeEqual(env.SESSION_SECRET!, code, env.GIFT_CODE!);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // 무차별 대입 완화
    return json({ authed: false }, 401);
  }
  return json({ authed: true }, 200, { 'Set-Cookie': await issueCookie(env) });
};

/** 로그아웃 */
export const onRequestDelete = async () => json({ authed: false }, 200, { 'Set-Cookie': clearCookie() });
