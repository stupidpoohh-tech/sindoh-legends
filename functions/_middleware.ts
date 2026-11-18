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
.err{color:#ffb0bb;min-height:20px}
@media(max-width:600px),(pointer:coarse){
body{background:#062353 url('/assets/game/welcome-poster.jpg') center top / auto 100% no-repeat}
main{justify-content:flex-end;padding:24px 16px max(24px,env(safe-area-inset-bottom))}
h1{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.entry-panel{width:min(100%,360px);padding:20px;box-sizing:border-box;border-radius:22px;border:1px solid #e8b94a88;background:#03112ccc;box-shadow:0 12px 30px #0005}
.entry-panel p{margin-bottom:12px}.entry-panel input{box-sizing:border-box;width:100%;background:#102754cc}.entry-panel button{width:100%}
@media(orientation:portrait){body{background-size:100% auto}main{justify-content:flex-start;padding-top:112vw}.entry-panel p{word-break:keep-all}}
@media(orientation:landscape){body{background-position:15% top}main{align-items:flex-end;justify-content:center;padding-right:5vw}.entry-panel{width:min(43vw,360px)}}
}
/* Gentle mobile-only welcome effects; all decoration is non-interactive. */
.welcome-fx { display:none; }
@media (max-width:600px), (pointer:coarse) {
  .welcome-fx { display:block; position:absolute; top:0; left:0; width:100%; height:177.68vw; overflow:hidden; z-index:1; }
  .welcome-fx, #ui .welcome-fx, .welcome-fx *, #ui .welcome-fx * { pointer-events:none !important; }
  .welcome-glow { position:absolute; left:28.5%; top:26%; width:20%; aspect-ratio:1; border-radius:50%; background:radial-gradient(circle,#d4ffff88, #2feaff44 35%,transparent 70%); mix-blend-mode:screen; transform:translate(-50%,-50%); animation:welcomePulse 4.8s ease-in-out infinite; }
  .welcome-spark { position:absolute; left:var(--x); top:78%; width:3px; height:3px; border-radius:50%; background:#ffe8a0; box-shadow:0 0 7px 2px #ffd76b66; opacity:0; animation:welcomeRise var(--duration) linear var(--delay) infinite; }
  #title.poster-title .title-actions, .entry-panel { position:relative; z-index:2; }
  #title.poster-title .title-actions { position:absolute; }
  #title.poster-title .title-actions .pill-btn, .entry-panel button { animation:welcomeEnter .9s ease both, welcomeFloat 4.2s ease-in-out .9s infinite; }
  #title.poster-title .title-actions .pill-btn:nth-of-type(3) { animation-delay:.12s,1.02s; }
  #title.poster-title .title-actions .pill-btn:nth-of-type(4) { animation-delay:.24s,1.14s; }
  #title.poster-title .title-actions .pill-btn:active, .entry-panel button:active { animation-play-state:paused; }
}
@media (orientation:landscape) and (pointer:coarse), (orientation:landscape) and (max-width:600px) {
  .welcome-fx { width:56.28vh; height:100vh; left:calc((100% - 56.28vh) * .15); }
  #title.poster-title .title-actions { position:relative; }
}
@keyframes welcomeFloat { 0%,100% { translate:0 0; } 50% { translate:0 -3px; } }
@keyframes welcomeEnter { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@keyframes welcomePulse { 0%,100% { opacity:.35; scale:1; } 50% { opacity:.8; scale:1.08; } }
@keyframes welcomeRise { 0% { opacity:0; transform:translate(0,0); } 20% { opacity:.7; } 75% { opacity:.4; } 100% { opacity:0; transform:translate(12px,-110px); } }
@media (prefers-reduced-motion:reduce) {
  .welcome-fx { display:none; }
  #title.poster-title .title-actions .pill-btn, .entry-panel button { animation:none; }
}
</style></head><body><main><div class="welcome-fx" aria-hidden="true"><i class="welcome-glow"></i><i class="welcome-spark" style="--x:18%;--delay:-0s;--duration:7s"></i><i class="welcome-spark" style="--x:33%;--delay:-1.7s;--duration:8s"></i><i class="welcome-spark" style="--x:47%;--delay:-3.4s;--duration:9s"></i><i class="welcome-spark" style="--x:62%;--delay:-5.1s;--duration:7s"></i><i class="welcome-spark" style="--x:76%;--delay:-6.8s;--duration:8s"></i><i class="welcome-spark" style="--x:86%;--delay:-8.5s;--duration:9s"></i></div>
<h1>SINDOH LEGENDS</h1><div class="entry-panel"><p>선물 받은 분만 입장할 수 있는 비공개 버전입니다.<br>입장 코드를 입력해 주세요.</p>
<form method="post" action="/__enter"><input name="code" type="password" autocomplete="off" placeholder="입장 코드" aria-label="입장 코드" required>
<p class="err">${msg}</p><button type="submit">입장</button></form></div></main></body></html>`;

const lockPage = (msg = '', status = 401) =>
  new Response(LOCK_HTML(msg), { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });

const redirectHome = async (env: Env) =>
  new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': await issueCookie(env), 'Cache-Control': 'no-store' } });

export const onRequest = async ({ request, env, next }: Ctx) => {
  if (env.EDITION !== 'private') return next();
  // This shared welcome artwork is also public in the portfolio edition.
  if (new URL(request.url).pathname === '/assets/game/welcome-poster.jpg' && ['GET', 'HEAD'].includes(request.method)) return next();
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
