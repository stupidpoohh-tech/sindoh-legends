/** LocalStorage 저장 데이터. 데이터가 깨졌거나 없으면 기본값으로 시작 */
const KEY = 'sindoh-legends-save-v1';

export type Stage = 'none' | 'lane' | 'boss' | 'nexus' | 'cleared';

export interface SaveData {
  tutorialDone: boolean;
  unlocked: string[]; // 해금한 기억(영상 해금 조건) id
  cleared: boolean;
  sound: { bgm: boolean; sfx: boolean };
  stage: Stage;
  progress: {
    destroyed: string[]; // 파괴한 구조물 id
    level: number;
    xp: number;
    bossDefeated: boolean;
  } | null;
}

const DEFAULT: SaveData = {
  tutorialDone: false,
  unlocked: [],
  cleared: false,
  sound: { bgm: true, sfx: true },
  stage: 'none',
  progress: null,
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function sanitize(raw: any): SaveData {
  const d = clone(DEFAULT);
  if (!raw || typeof raw !== 'object') return d;
  if (typeof raw.tutorialDone === 'boolean') d.tutorialDone = raw.tutorialDone;
  if (Array.isArray(raw.unlocked)) d.unlocked = raw.unlocked.filter((x: any) => typeof x === 'string');
  if (typeof raw.cleared === 'boolean') d.cleared = raw.cleared;
  if (raw.sound && typeof raw.sound === 'object') {
    d.sound.bgm = raw.sound.bgm !== false;
    d.sound.sfx = raw.sound.sfx !== false;
  }
  if (['none', 'lane', 'boss', 'nexus', 'cleared'].includes(raw.stage)) d.stage = raw.stage;
  const p = raw.progress;
  if (p && typeof p === 'object' && Array.isArray(p.destroyed)) {
    d.progress = {
      destroyed: p.destroyed.filter((x: any) => typeof x === 'string'),
      level: Math.max(1, Math.min(3, Number(p.level) || 1)),
      xp: Math.max(0, Number(p.xp) || 0),
      bossDefeated: !!p.bossDefeated,
    };
  }
  return d;
}

let data: SaveData = load();

function load(): SaveData {
  try {
    const s = localStorage.getItem(KEY);
    return sanitize(s ? JSON.parse(s) : null);
  } catch {
    return clone(DEFAULT);
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 사파리 사생활 보호 모드 등: 저장 실패해도 게임은 계속 */
  }
}

export const save = {
  get data(): Readonly<SaveData> {
    return data;
  },
  update(fn: (d: SaveData) => void) {
    fn(data);
    persist();
  },
  unlock(id: string): boolean {
    if (data.unlocked.includes(id)) return false;
    data.unlocked.push(id);
    persist();
    return true;
  },
  hasProgress() {
    return !!data.progress && data.stage !== 'none' && data.stage !== 'cleared';
  },
  /** 진행만 초기화 (해금 기록·튜토리얼·사운드 설정은 유지) */
  resetProgress() {
    data.progress = null;
    data.stage = 'none';
    persist();
  },
  /** 저장 데이터 전체 삭제 */
  wipe() {
    data = clone(DEFAULT);
    persist();
  },
};
