/**
 * 전투 밸런스 설정 — 모든 수치는 이 파일 한 곳에서 조절합니다.
 * 시간 단위: 초, 거리 단위: 월드 픽셀(맵 2400 x 2400).
 */
export const BALANCE = {
  player: {
    hp: 1100,
    hpPerLevel: 260,
    speed: 235,
    attack: 58,
    attackPerLevel: 16,
    attackInterval: 0.68,
    attackRange: 205,
    /** 대기 상태에서 자동 공격 대상을 찾는 범위 */
    autoAcquireRange: 215,
    regenPerSec: 6,
    /** 아군 본진(분수) 회복: 초당 최대 HP 비율 */
    fountainHealPerSec: 0.12,
    respawnSeconds: 4,
  },

  xp: {
    /** 레벨 2, 레벨 3에 필요한 누적 경험치 */
    levels: [0, 160, 420],
    maxLevel: 3,
    minion: 22,
    ransomware: 45,
    turret: 70,
    inhibitor: 50,
    /** 이 거리 안에서 적이 쓰러져야 경험치 획득 */
    shareRange: 850,
  },

  skills: {
    q: { cooldown: 4, damage: 125, damagePerLevel: 40, range: 300, coneDeg: 75, structureMult: 0.5 },
    w: { cooldown: 12, duration: 4.5, damageReduction: 0.5, heal: 90, radius: 320 },
    r: {
      cooldown: 45,
      /** 게임 시작 직후 첫 사용까지 대기 */
      initialCooldown: 25,
      burstDamage: 380,
      burstRadius: 400,
      /** ZERO DAY에게 추가로 주는 최대 HP 비율 피해 */
      bossBonusRatio: 0.22,
      rallyCount: 2, // 팀당 소환 수
      rallyDuration: 12,
    },
  },

  minionWave: {
    interval: 15,
    firstDelay: 1.5,
    maxUnits: 70,
    /** 플레이어가 이 거리 안에 있는 라인만 정밀 시뮬레이션 */
    activeLaneDistance: 650,
    /** 비활성 라인 전선이 균형점으로 이동하는 속도(px/s) */
    dormantDrift: 12,
  },

  /** 팀별 미니언 (추진팀: 근접 돌격·원거리 지원 / 개발팀: 원거리 기술·대포 / 사업팀: 근접 지원·복합기 포격) */
  allyUnits: {
    push: { hp: 470, damage: 19, interval: 1.0, range: 48, speed: 88, armor: 0.78, aggro: 210 },
    pushR: { hp: 290, damage: 21, interval: 1.1, range: 165, speed: 88, armor: 1, aggro: 220 },
    dev: { hp: 300, damage: 24, interval: 1.1, range: 175, speed: 88, armor: 1, aggro: 220 },
    devC: { hp: 380, damage: 42, interval: 1.6, range: 200, speed: 80, armor: 0.9, aggro: 230 },
    biz: { hp: 430, damage: 21, interval: 1.0, range: 50, speed: 86, armor: 0.85, aggro: 210 },
    bizC: { hp: 420, damage: 46, interval: 1.6, range: 205, speed: 82, armor: 0.9, aggro: 230 },
  },
  /** 라인별 아군 웨이브 구성 */
  allyWaves: {
    push: ['push', 'push', 'pushR'],
    dev: ['dev', 'dev', 'devC'],
    biz: ['biz', 'biz', 'bizC'],
  },

  enemyUnits: {
    bug: { hp: 250, damage: 15, interval: 1.0, range: 44, speed: 88, armor: 1, aggro: 210 },
    phishing: { hp: 190, damage: 17, interval: 1.2, range: 170, speed: 86, armor: 1, aggro: 220, slow: 0.35, slowTime: 1.4 },
    ransomware: { hp: 950, damage: 32, interval: 1.3, range: 58, speed: 70, armor: 1, aggro: 220, lockEvery: 6.5, lockRadius: 170, lockTime: 1.2 },
    /** 억제기가 살아 있을 때 해당 라인 적 HP 배율 / 랜섬웨어 등장 주기(웨이브) */
    empoweredHpMult: 1.25,
    ransomwareEveryWaves: 3,
  },

  structures: {
    enemyTurret: { hp: 5400, damage: 95, minionDamage: 85, interval: 1.15, range: 270 },
    allyTurret: { damage: 80, interval: 1.0, range: 270 },
    inhibitor: { hp: 2000 },
    firewall: { hp: 1500, damage: 45, interval: 1.4, range: 240 },
    nexus: { hp: 6000 },
  },

  boss: {
    hp: 15000,
    speed: 110,
    shotDamage: 70,
    shotSpeed: 360,
    aoeDamage: 170,
    aoeRadius: 115,
    aoeWarn: 1.25,
    patternGap: 2.3,
    summonCount: 3,
    /** 이 비율 이하로 떨어지면 아군 지원 이벤트 */
    supportAt: 0.35,
    /** 궁극기를 사용하기 전에는 이 비율 아래로 내려가지 않음 */
    floorBeforeUlt: 0.18,
    meleeDamage: 40,
  },
} as const;

export type UnitStats = {
  hp: number;
  damage: number;
  interval: number;
  range: number;
  speed: number;
  armor: number;
  aggro: number;
};
