/**
 * 선물(PRIVATE) 버전 인증.
 * - 입장 코드(GIFT_CODE, Pages 암호화 변수)를 서버에서 검증한 뒤 서명된 HttpOnly 쿠키를 발급합니다.
 * - 쿠키 값: <만료시각>.<HMAC-SHA256(만료시각, SESSION_SECRET)>
 * - 영상 API 는 쿠키 서명·만료를 매 요청 검증합니다.
 */
export interface Env {
  EDITION?: string;
  GIFT_CODE?: string;
  SESSION_SECRET?: string;
  VIDEOS?: any; // R2Bucket
  VIDEO_KEYS?: string;
  VIDEO_ESPORTS_KEY?: string;
  VIDEO_WORKSHOP_02_KEY?: string;
}

export const COOKIE = 'sl_auth';
const MAX_AGE = 60 * 60 * 24 * 180; // 180일 (선물 받은 기기에서 다시 묻지 않도록)
const enc = new TextEncoder();

function b64url(buf: ArrayBuffer) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

/** 길이·내용 노출 없는 비교 (양쪽을 HMAC 한 뒤 비교) */
export async function safeEqual(secret: string, a: string, b: string) {
  const [x, y] = await Promise.all([hmac(secret, 'cmp:' + a), hmac(secret, 'cmp:' + b)]);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.min(x.length, y.length); i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

export function configured(env: Env) {
  return env.EDITION === 'private' && !!env.GIFT_CODE && !!env.SESSION_SECRET && (env.SESSION_SECRET?.length ?? 0) >= 16;
}

export async function issueCookie(env: Env) {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const sig = await hmac(env.SESSION_SECRET!, exp);
  return `${COOKIE}=${exp}.${sig}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function isAuthed(request: Request, env: Env) {
  if (!configured(env)) return false;
  const raw = request.headers.get('Cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  const expect = await hmac(env.SESSION_SECRET!, exp);
  return safeEqual(env.SESSION_SECRET!, sig, expect);
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}
