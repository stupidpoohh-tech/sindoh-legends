import { configured, Env, isAuthed, issueCookie, safeEqual } from './_lib/auth';

/**
 * PRIVATE(선물) 판: 사이트 전체를 서버에서 잠금.
 *  - NFC 주소 /?k=<입장코드> → 코드 검증 → 세션 쿠키 발급 → 코드 없는 주소로 이동
 *  - 쿠키 없는 페이지 요청 → 입장 코드 화면, 그 외(자산·API) → 401
 * PUBLIC 판(EDITION 미설정): 아무것도 하지 않음 (모두 공개)
 */
type Ctx = { request: Request; env: Env; next: () => Promise<Response> };

const LOCK_HTML = (msg = '') => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow">
<title>SINDOH LEGENDS</title><style>
html,body{margin:0;height:100%;background:radial-gradient(ellipse at 50% 35%,#16306e,#050d1f 70%);color:#fff;font-family:system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif}
main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;box-sizing:border-box;text-align:center}
h1{margin:0;font-size:26px;letter-spacing:.06em;color:#ffe28a}p{margin:0;color:#c6d3e4;font-size:14px;line-height:1.6}
input{width:min(80vw,280px);min-height:48px;border-radius:12px;border:1.5px solid #e8b94a;background:rgba(255,255,255,.08);color:#fff;font-size:17px;text-align:center}
button{min-width:160px;min-height:48px;border-radius:999px;border:2px solid #e8b94a;background:linear-gradient(180deg,#2f56c4,#122c78);color:#fff;font-size:16px;font-weight:700}
.err{color:#ffb0bb;min-height:20px}</style></head><body><main>
<h1>SINDOH LEGENDS</h1><p>선물 받은 분만 입장할 수 있는 비공개 버전입니다.<br>입장 코드를 입력해 주세요.</p>
<form method="post" action="/__enter"><input name="code" type="password" autocomplete="off" placeholder="입장 코드" aria-label="입장 코드" required>
<p class="err">${msg}</p><button type="submit">입장</button></form></main></body></html>`;

const lockPage = (msg = '', status = 401) =>
  new Response(LOCK_HTML(msg), { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });

const redirectHome = async (env: Env) =>
  new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': await issueCookie(env), 'Cache-Control': 'no-store' } });

export const onRequest = async ({ request, env, next }: Ctx) => {
  if (env.EDITION !== 'private') return next();
  // 비공개 판인데 비밀 값이 빠져 있으면 공개하지 않고 잠금 유지
  if (!configured(env)) return new Response('Private edition is not configured.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const url = new URL(request.url);

  // 입장 코드 폼 제출
  if (url.pathname === '/__enter' && request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const code = String(form?.get('code') || '').trim().slice(0, 200);
    if (code && (await safeEqual(env.SESSION_SECRET!, code, env.GIFT_CODE!))) return redirectHome(env);
    await new Promise((r) => setTimeout(r, 600));
    return lockPage('입장 코드가 맞지 않습니다.');
  }
  // NFC 주소의 코드
  const k = url.searchParams.get('k');
  if (k !== null) {
    if (await safeEqual(env.SESSION_SECRET!, k.trim(), env.GIFT_CODE!)) return redirectHome(env);
    await new Promise((r) => setTimeout(r, 600));
    return lockPage('입장 코드가 맞지 않습니다.');
  }
  if (await isAuthed(request, env)) {
    const res = await next();
    const h = new Headers(res.headers);
    h.set('X-Robots-Tag', 'noindex, nofollow');
    // 인증된 사용자만 받는 내용이므로 공유 캐시 금지
    const cc = h.get('Cache-Control') || 'max-age=0, must-revalidate';
    h.set('Cache-Control', /\bpublic\b/.test(cc) ? cc.replace(/\bpublic\b/, 'private') : cc.includes('private') || cc.includes('no-store') ? cc : 'private, ' + cc);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  }
  const accept = request.headers.get('Accept') || '';
  if (request.method === 'GET' && accept.includes('text/html')) return lockPage();
  return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
};
