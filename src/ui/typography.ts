import Phaser from 'phaser';

/**
 * 캔버스(Phaser) 텍스트 스타일 — HTML UI 와 같은 서체·위계를 사용합니다.
 * 크기는 월드 좌표 기준. 모바일 세로 카메라 배율(약 0.67)에서 화면상 11~15px 이 되도록 정했습니다.
 */
export const FONT = "Freesentation, Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const RES = Math.min(4, Math.ceil(Math.min(window.devicePixelRatio || 1, 2) * 1.6));

type Role = 'champion' | 'captain' | 'rally' | 'sign' | 'bubble' | 'damage' | 'heal' | 'gate' | 'float';

const ROLE: Record<Role, Phaser.Types.GameObjects.Text.TextStyle> = {
  // 챔피언 이름: 따뜻한 아이보리, 얇은 외곽선
  champion: { fontSize: '19px', fontStyle: '600', color: '#fff1cf', stroke: 'rgba(12,22,44,0.8)', strokeThickness: 3 },
  // 팀장 이름표: 반투명 남색 배경판
  captain: { fontSize: '17px', fontStyle: '600', color: '#fff1cf', backgroundColor: 'rgba(14,30,72,0.78)', padding: { x: 7, y: 2 } },
  rally: { fontSize: '15px', fontStyle: '600', color: '#e9f1ff', stroke: 'rgba(12,22,44,0.7)', strokeThickness: 3 },
  // 라인 표지판: 차분한 팀 색 + 배경판
  sign: { fontSize: '22px', fontStyle: '700', color: '#ffffff', backgroundColor: 'rgba(12,26,52,0.62)', padding: { x: 10, y: 4 } },
  bubble: { fontSize: '19px', fontStyle: '600', color: '#18233f' },
  damage: { fontSize: '19px', fontStyle: '700', color: '#ffe7a6', stroke: 'rgba(20,14,6,0.75)', strokeThickness: 3 },
  heal: { fontSize: '14px', fontStyle: '700', color: '#ffb0bb', stroke: 'rgba(30,6,12,0.75)', strokeThickness: 3 },
  gate: { fontSize: '16px', fontStyle: '600', color: '#eadcff', stroke: 'rgba(27,15,51,0.8)', strokeThickness: 3 },
  float: { fontSize: '19px', fontStyle: '600', color: '#cfeaff', stroke: 'rgba(12,22,44,0.8)', strokeThickness: 3 },
};

export function gameText(scene: Phaser.Scene, x: number, y: number, text: string, role: Role, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  const t = scene.add.text(x, y, text, { fontFamily: FONT, resolution: RES, ...ROLE[role], ...extra }).setOrigin(0.5);
  TRACKED.add(t);
  t.once('destroy', () => TRACKED.delete(t));
  return t;
}

/** 서체가 늦게 도착하면 이미 만든 캔버스 텍스트를 다시 그림 */
const TRACKED = new Set<Phaser.GameObjects.Text>();
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener('loadingdone', () => {
    for (const t of TRACKED) if (t.active) t.updateText();
  });
}

/** 라인 표지판용 차분한 팀 색 */
export const TEAM_TEXT: Record<string, string> = { push: '#a9c4f5', dev: '#93d6ee', biz: '#9fdcbc' };
