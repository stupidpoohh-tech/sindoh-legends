/**
 * 영상 id(게임 내) → R2 객체 키 매핑. 서버(Pages Functions)에서만 사용되며 정적 빌드(dist)에는 포함되지 않습니다.
 * 새 영상을 R2 에 올렸다면 여기 키만 맞추면 됩니다.
 */
export const VIDEO_KEYS: Record<string, string> = {
  workshop_01: '워크샵1.mp4',
  workshop_02: '워크샵2.mp4',
  workshop_03: '워크샵3.mp4',
  esports: '게임대회.mp4',
  // 감사 영상: R2 에 아래 이름으로 업로드하면 바로 연결됩니다 (아직 미업로드)
  thankyou: '감사영상.mp4',
};
