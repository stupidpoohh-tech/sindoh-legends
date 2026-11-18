/**
 * PRIVATE(선물) 버전 전용 — 영상 API(/api/video/:id)와 입장 코드 인증.
 * PUBLIC 빌드에서는 이 모듈을 불러오지 않으므로 API 경로가 번들에 포함되지 않습니다.
 */
const url = (p: string) => new URL(p, document.baseURI).href;

let authed = false;
let checked: Promise<boolean> | null = null;

/** NFC 주소에 포함된 입장 코드(?k=… 또는 #k=…)를 서버에 제출하고 주소창에서 지움 */
export function initPrivateAuth() {
  if (checked) return checked;
  checked = (async () => {
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const code = q.get('k') || h.get('k');
    if (code) {
      q.delete('k');
      h.delete('k');
      const rest = (q.toString() ? '?' + q : '') + (h.toString() ? '#' + h : '');
      history.replaceState(null, '', location.pathname + rest);
      if (await login(code)) return true;
    }
    try {
      const r = await fetch(url('api/auth'), { credentials: 'same-origin', cache: 'no-store' });
      authed = r.ok && !!(await r.json()).authed;
    } catch {
      authed = false;
    }
    return authed;
  })();
  return checked;
}

export async function login(code: string) {
  try {
    const r = await fetch(url('api/auth'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    authed = r.ok;
  } catch {
    authed = false;
  }
  return authed;
}

export const isAuthed = () => authed;
export const videoUrl = (id: string) => url(`api/video/${encodeURIComponent(id)}`);

/** 재생 실패 원인 확인: 'auth' | 'missing' | 'network' */
export async function diagnose(id: string): Promise<'auth' | 'missing' | 'network'> {
  try {
    const r = await fetch(videoUrl(id), { method: 'HEAD', credentials: 'same-origin', cache: 'no-store' });
    if (r.status === 401) {
      authed = false;
      return 'auth';
    }
    if (r.status === 404) return 'missing';
    return 'network';
  } catch {
    return 'network';
  }
}
