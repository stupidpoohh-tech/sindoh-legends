/**
 * 영상 id(게임 내) → R2 객체 키 매핑.
 * 비공개 파일 이름이 저장소에 남지 않도록 PRIVATE Pages 프로젝트의 환경 변수 VIDEO_KEYS(JSON)에서 읽습니다.
 * 예: {"workshop_01":"파일1.mp4","workshop_02":"파일2.mp4","workshop_03":"파일3.mp4","esports":"파일4.mp4"}
 */
// Optional per-video replacements; other video mappings remain untouched.
export function videoKey(env: { VIDEO_KEYS?: string; VIDEO_ESPORTS_KEY?: string; VIDEO_WORKSHOP_02_KEY?: string }, id: string): string | null {
  if (!/^[a-z0-9_]{1,40}$/.test(id)) return null;
  if (id === 'esports' && env.VIDEO_ESPORTS_KEY?.trim()) return env.VIDEO_ESPORTS_KEY.trim();
  if (id === 'workshop_02' && env.VIDEO_WORKSHOP_02_KEY?.trim()) return env.VIDEO_WORKSHOP_02_KEY.trim();
  if (!env.VIDEO_KEYS) return null;
  try {
    const map = JSON.parse(env.VIDEO_KEYS) as Record<string, unknown>;
    const v = map[id];
    return typeof v === 'string' && v ? v : null;
  } catch {
    return null;
  }
}
