import { Env, isAuthed } from '../../_lib/auth';
import { videoKey } from '../../_lib/videos';

type Ctx = { request: Request; env: Env; params: { id: string } };

const plain = (status: number, msg: string, extra: Record<string, string> = {}) =>
  new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

/** "bytes=a-b" / "bytes=a-" / "bytes=-n" → [start, end] (포함), 실패 시 null */
function parseRange(h: string, size: number): [number, number] | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(h.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number, end: number;
  if (m[1] === '') {
    const n = Number(m[2]);
    if (n === 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return null;
  return [start, end];
}

async function serve({ request, env, params }: Ctx, headOnly: boolean) {
  if (!(await isAuthed(request, env))) return plain(401, '인증이 필요합니다.');
  const name = videoKey(env, params.id);
  if (!name || !env.VIDEOS) return plain(404, '영상을 찾을 수 없습니다.');
  // 업로드 도구에 따라 한글 키가 URL 인코딩되어 저장되는 경우도 함께 확인
  let key = name;
  let meta = await env.VIDEOS.head(key);
  if (!meta) {
    key = encodeURIComponent(name);
    meta = await env.VIDEOS.head(key);
  }
  if (!meta) return plain(404, '영상이 아직 업로드되지 않았습니다.');
  const size: number = meta.size;
  const base: Record<string, string> = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    ETag: meta.httpEtag,
    'Content-Disposition': 'inline',
  };
  const rangeHeader = request.headers.get('Range');
  if (!rangeHeader) {
    if (headOnly) return new Response(null, { status: 200, headers: { ...base, 'Content-Length': String(size) } });
    const obj = await env.VIDEOS.get(key);
    if (!obj) return plain(404, '영상이 아직 업로드되지 않았습니다.');
    return new Response(obj.body, { status: 200, headers: { ...base, 'Content-Length': String(size) } });
  }
  const r = parseRange(rangeHeader, size);
  if (!r) return plain(416, '요청 범위가 올바르지 않습니다.', { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' });
  const [start, end] = r;
  const length = end - start + 1;
  const headers = { ...base, 'Content-Length': String(length), 'Content-Range': `bytes ${start}-${end}/${size}` };
  if (headOnly) return new Response(null, { status: 206, headers });
  const obj = await env.VIDEOS.get(key, { range: { offset: start, length } });
  if (!obj) return plain(404, '영상이 아직 업로드되지 않았습니다.');
  return new Response(obj.body, { status: 206, headers });
}

export const onRequestGet = (ctx: Ctx) => serve(ctx, false);
export const onRequestHead = (ctx: Ctx) => serve(ctx, true);
