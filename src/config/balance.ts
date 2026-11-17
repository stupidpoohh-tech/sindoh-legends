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
  /** 팀장 NPC (라인당 1명, 미니언 AI 재사용). 일반 미니언 대비 HP 약 2.3배, 공격력 약 1.35배 */
  captains: {
    push: { hp: 1100, damage: 26, interval: 1.0, range: 52, speed: 88, armor: 0.7, aggro: 230 },
    dev: { hp: 820, damage: 33, interval: 1.05, range: 190, speed: 88, armor: 0.9, aggro: 240 },
    biz: { hp: 950, damage: 58, interval: 1.5, range: 205, speed: 84, armor: 0.85, aggro: 240 },
    respawnSeconds: 15,
    /** 팀장이 적 구조물을 공격하려면 부장님이 이 거리 안에 있어야 함 (단독 공략 방지) */
    structureAssistRange: 650,
    passiveRadius: 300,
    /** 추진팀장 '전방 지휘': 받는 피해 배율 */
    pushDamageTaken: 0.8,
    /** 개발팀장 '기술 지원': 공격 간격 배율 (0.8 = 공격 속도 +25%) */
    devAttackInterval: 0.8,
    /** 사업팀장 '전략적 지원': 포탑·구조물 대상 피해 배율 */
    bizStructureDamage: 1.3,
    /** 비활성(화면 밖) 라인에 있을 때 초당 HP 회복 비율 */
    dormantRegen: 0.03,
    /** HP 비율이 이 값 아래면 아군 포탑으로 후퇴 → retreatUntil 까지 회복 후 복귀 */
    retreatAt: 0.25,
    retreatUntil: 0.75,
    retreatRegen: 0.08,
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
    enemyTurret: { hp: 7000, damage: 95, minionDamage: 85, interval: 1.15, range: 270 },
    allyTurret: { damage: 80, interval: 1.0, range: 270 },
    inhibitor: { hp: 2400 },
    firewall: { hp: 1500, damage: 45, interval: 1.4, range: 240 },
    nexus: { hp: 6000 },
  },

  boss: {
    hp: 17000,
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
