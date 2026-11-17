/** 협곡 맵의 기하 정보. 아군 본진은 좌하단, 적 본진은 우상단. */
export type Pt = { x: number; y: number };
export type LaneId = 'top' | 'mid' | 'bot';
export type TeamId = 'push' | 'dev' | 'biz';

export const WORLD = { w: 2400, h: 2400, cell: 30 };

export const ALLY_BASE: Pt = { x: 330, y: 2070 };
export const ENEMY_BASE: Pt = { x: 2070, y: 330 };
export const BASE_RADIUS = 300;
export const ALLY_NEXUS: Pt = { x: 250, y: 2150 };
export const ENEMY_NEXUS: Pt = { x: 2120, y: 280 };
export const BOSS_SPAWN: Pt = { x: 1990, y: 420 };
export const FIREWALLS: Pt[] = [
  { x: 1960, y: 230 },
  { x: 2210, y: 470 },
];

export interface LaneDef {
  id: LaneId;
  team: TeamId;
  teamName: string;
  label: string;
  greeting: string;
  /** 아군 본진 → 적 본진 방향 경로 */
  path: Pt[];
  allyTurret: Pt;
  enemyTurret: Pt;
  inhibitor: Pt;
  gate: Pt;
  /** 게이트 막대의 방향(라인 진행 방향에 수직) */
  gateAngle: number;
  sign: Pt;
}

export const LANES: LaneDef[] = [
  {
    id: 'top',
    team: 'push',
    teamName: '추진팀',
    label: 'TOP',
    greeting: '부장님, 진격 준비 완료했습니다!',
    path: [
      { x: 300, y: 1830 },
      { x: 300, y: 470 },
      { x: 330, y: 380 },
      { x: 400, y: 320 },
      { x: 480, y: 300 },
      { x: 1760, y: 300 },
      { x: 1960, y: 310 },
      { x: 2080, y: 300 },
    ],
    allyTurret: { x: 375, y: 1380 },
    enemyTurret: { x: 1230, y: 300 },
    inhibitor: { x: 1600, y: 300 },
    gate: { x: 1745, y: 300 },
    gateAngle: Math.PI / 2,
    sign: { x: 200, y: 1770 },
  },
  {
    id: 'mid',
    team: 'dev',
    teamName: '개발팀',
    label: 'MID',
    greeting: '보안 패치 준비 완료!',
    path: [
      { x: 520, y: 1880 },
      { x: 1780, y: 620 },
      { x: 1900, y: 500 },
      { x: 2080, y: 320 },
    ],
    allyTurret: { x: 840, y: 1650 },
    enemyTurret: { x: 1270, y: 1130 },
    inhibitor: { x: 1570, y: 830 },
    gate: { x: 1710, y: 690 },
    gateAngle: Math.PI / 4,
    sign: { x: 600, y: 1990 },
  },
  {
    id: 'bot',
    team: 'biz',
    teamName: '사업팀',
    label: 'BOT',
    greeting: '이번 승리도 계약하겠습니다!',
    path: [
      { x: 570, y: 2100 },
      { x: 1930, y: 2100 },
      { x: 2020, y: 2080 },
      { x: 2080, y: 2020 },
      { x: 2100, y: 1930 },
      { x: 2100, y: 650 },
      { x: 2090, y: 470 },
      { x: 2080, y: 320 },
    ],
    allyTurret: { x: 1020, y: 2025 },
    enemyTurret: { x: 2100, y: 1270 },
    inhibitor: { x: 2100, y: 900 },
    gate: { x: 2100, y: 760 },
    gateAngle: 0,
    sign: { x: 640, y: 2215 },
  },
];

/** 이동 가능 영역: 라인 폭, 강, 정글 길 */
export const LANE_HALF_WIDTH = 82;
export const RIVER = { from: { x: 470, y: 470 }, to: { x: 1930, y: 1930 }, half: 62 };

export const JUNGLE_PATHS: { pts: Pt[]; half: number }[] = [
  // 위쪽 정글 (탑-미드 사이)
  { pts: [{ x: 300, y: 1150 }, { x: 640, y: 1100 }, { x: 760, y: 880 }, { x: 1000, y: 650 }, { x: 1150, y: 300 }], half: 46 },
  { pts: [{ x: 760, y: 880 }, { x: 900, y: 1500 }], half: 44 },
  { pts: [{ x: 1000, y: 650 }, { x: 1300, y: 760 }, { x: 1420, y: 980 }], half: 42 },
  // 아래쪽 정글 (미드-바텀 사이)
  { pts: [{ x: 1250, y: 2100 }, { x: 1300, y: 1760 }, { x: 1560, y: 1640 }, { x: 1760, y: 1420 }, { x: 2100, y: 1150 }], half: 46 },
  { pts: [{ x: 1560, y: 1640 }, { x: 1080, y: 1340 }], half: 42 },
  { pts: [{ x: 1760, y: 1420 }, { x: 1680, y: 1120 }, { x: 1450, y: 1000 }], half: 40 },
];

export const CLEARINGS: { c: Pt; r: number }[] = [
  { c: { x: 760, y: 880 }, r: 95 },
  { c: { x: 1000, y: 650 }, r: 80 },
  { c: { x: 1560, y: 1640 }, r: 95 },
  { c: { x: 1760, y: 1420 }, r: 80 },
  { c: { x: 1200, y: 1200 }, r: 110 }, // 강 중앙 (미드와 교차)
];

/** 추억의 기록 위치 */
export interface MemorySpot {
  id: string;
  kind: 'box' | 'orb' | 'monument';
  pos: Pt;
  label: string;
}
export const MEMORY_SPOTS: MemorySpot[] = [
  { id: 'mem_base', kind: 'box', pos: { x: 190, y: 1930 }, label: '본진의 기록 상자' },
  { id: 'mem_jungle', kind: 'orb', pos: { x: 760, y: 880 }, label: '숲속의 기억 구슬' },
  { id: 'mem_river', kind: 'monument', pos: { x: 1560, y: 1560 }, label: '강가의 기념비' },
];
/** 첫 적 포탑 파괴 시 획득하는 기록 id */
export const MEMORY_TURRET_ID = 'mem_turret';
export const MEMORY_VICTORY_ID = 'mem_victory';

export function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToPolyline(p: Pt, pts: Pt[]) {
  let m = Infinity;
  for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distToSegment(p, pts[i], pts[i + 1]));
  return m;
}

/** 경로를 거리(s)로 매개화한 헬퍼 */
export class Polyline {
  readonly pts: Pt[];
  readonly cum: number[] = [0];
  readonly length: number;
  constructor(pts: Pt[]) {
    this.pts = pts;
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + dist(pts[i - 1], pts[i]));
    this.length = this.cum[this.cum.length - 1];
  }
  at(s: number): Pt {
    s = Math.max(0, Math.min(this.length, s));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const a = this.pts[i - 1],
      b = this.pts[i];
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    const t = (s - this.cum[i - 1]) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  /** 점을 경로에 투영한 s 값 */
  project(p: Pt): number {
    let best = Infinity,
      bestS = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i],
        b = this.pts[i + 1];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const l2 = dx * dx + dy * dy || 1;
      let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      if (d < best) {
        best = d;
        bestS = this.cum[i] + t * Math.sqrt(l2);
      }
    }
    return bestS;
  }
}

export function isWalkableGeom(p: Pt): boolean {
  if (p.x < 40 || p.y < 40 || p.x > WORLD.w - 40 || p.y > WORLD.h - 40) return false;
  if (dist(p, ALLY_BASE) < BASE_RADIUS) return true;
  if (dist(p, ENEMY_BASE) < BASE_RADIUS) return true;
  for (const l of LANES) if (distToPolyline(p, l.path) < LANE_HALF_WIDTH) return true;
  if (distToSegment(p, RIVER.from, RIVER.to) < RIVER.half) return true;
  for (const j of JUNGLE_PATHS) if (distToPolyline(p, j.pts) < j.half) return true;
  for (const c of CLEARINGS) if (dist(p, c.c) < c.r) return true;
  return false;
}
