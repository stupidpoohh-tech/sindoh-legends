import Phaser from 'phaser';
import { BALANCE, UnitStats } from '../config/balance';
import { runtime } from '../config/runtime';
import { bus } from '../core/events';
import { fsm, GameState } from '../core/state';
import { save } from '../core/save';
import { audio } from '../audio/audio';
import { paintMap } from '../art/mapPainter';
import { FACE_ANCHOR } from '../art/svgs';
import { NavGrid } from '../world/grid';
import {
  WORLD, LANES, ALLY_BASE, ENEMY_BASE, BASE_RADIUS, ALLY_NEXUS, ENEMY_NEXUS, BOSS_SPAWN, FIREWALLS,
  MEMORY_SPOTS, MEMORY_TURRET_ID, MEMORY_VICTORY_ID, Pt, TeamId,
} from '../world/mapData';
import { Unit, Kind, Side } from '../entities/Unit';
import { CAPTAIN_DEFS } from '../config/captains';
import { gameText, TEAM_TEXT } from '../ui/typography';
import { LaneManager, LaneRuntime, LaneHost } from '../systems/LaneManager';

type SkillKey = 'q' | 'w' | 'r';

interface Projectile {
  img: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  x: number;
  y: number;
  target: Unit | null;
  dirX: number;
  dirY: number;
  speed: number;
  damage: number;
  source: Unit;
  side: Side;
  travelled: number;
  maxDist: number;
  radius: number;
  spin: number;
  onHit?: (t: Unit) => void;
  dead?: boolean;
}

type ViewDef = { tex: string; h: number; r: number; hpW?: number; hpY?: number; shadowW?: number; norm?: boolean; anim?: Unit['anim'] };
const minionAnim = (k: string): Unit['anim'] => ({
  idle: [`m_${k}_idle`],
  run: [`m_${k}_run_0`, `m_${k}_run_1`, `m_${k}_run_2`, `m_${k}_run_1`],
  atk: `m_${k}_atk`,
  hit: `m_${k}_hit`,
});
const mv = (k: string, h = 58): ViewDef => ({ tex: `m_${k}_idle`, h, r: 16, hpW: 32, hpY: -h - 8, anim: minionAnim(k) });
/** 팀장 NPC: 일반 미니언(58)의 약 1.4배 */
const capView = (t: string): ViewDef => ({
  tex: `cap_${t}_idle_0`, h: 82, r: 20, hpW: 44, hpY: -92,
  anim: {
    idle: t === 'biz' ? ['cap_biz_idle_0', 'cap_biz_idle_1', 'cap_biz_idle_2', 'cap_biz_idle_3'] : [`cap_${t}_idle_0`],
    run: [0, 1, 2, 3].map((i) => `cap_${t}_run_${i}`),
    atk: t === 'push' ? 'cap_push_atk_2' : `cap_${t}_atk_3`,
    hit: `cap_${t}_hit`,
  },
});
const CAPTAIN_KIND: Record<TeamId, Kind> = { push: 'capPush', dev: 'capDev', biz: 'capBiz' };
const KIND_VIEW: Record<Kind, ViewDef> = {
  player: {
    tex: 'champ_idle', h: 104, r: 22, hpW: 50, hpY: -110,
    anim: { idle: ['champ_idle'], run: ['champ_run_0', 'champ_run_1', 'champ_run_2', 'champ_run_3'], atk: 'champ_atk_2', hit: 'champ_hit' },
  },
  push: mv('push'),
  pushR: mv('pushR'),
  dev: mv('dev'),
  devC: mv('devC', 54),
  biz: mv('biz'),
  bizC: mv('bizC', 54),
  capPush: capView('push'),
  capDev: capView('dev'),
  capBiz: capView('biz'),
  bug: { tex: 'e_bug_0', h: 42, r: 16, hpW: 30, hpY: -50, anim: { idle: ['e_bug_0', 'e_bug_1'], run: ['e_bug_0', 'e_bug_1', 'e_bug_2', 'e_bug_1'], atk: 'e_bug_2' } },
  phishing: { tex: 'e_phish_0', h: 44, r: 16, hpW: 30, hpY: -70, shadowW: 26, anim: { idle: ['e_phish_0', 'e_phish_1'], run: ['e_phish_0', 'e_phish_1'], atk: 'e_phish_2' } },
  ransomware: { tex: 'e_ransom_0', h: 70, r: 24, hpW: 48, hpY: -80, anim: { idle: ['e_ransom_0'], run: ['e_ransom_0', 'e_ransom_1'], atk: 'e_ransom_2' } },
  boss: { tex: 'boss_main', h: 170, r: 42, shadowW: 120, norm: true, anim: { idle: ['boss_main'], run: ['boss_main', 'boss_idle'], atk: 'boss_slash' } },
  turret: { tex: 's_turret', h: 140, r: 44, hpW: 80, hpY: -150, shadowW: 120, norm: true },
  allyTurret: { tex: 's_ally_turret', h: 140, r: 44, shadowW: 120, norm: true },
  inhibitor: { tex: 's_inhib', h: 100, r: 36, hpW: 64, hpY: -110, shadowW: 110, norm: true },
  firewall: { tex: 's_firewall', h: 92, r: 28, hpW: 56, hpY: -104, shadowW: 76, norm: true },
  nexus: { tex: 's_nexus', h: 200, r: 84, hpW: 130, hpY: -212, shadowW: 220, norm: true },
  allyNexus: { tex: 's_ally_nexus', h: 190, r: 70, shadowW: 180, norm: true },
};
const RUIN: Partial<Record<Kind, string>> = { turret: 's_turret_ruin', inhibitor: 's_inhib_ruin', firewall: 's_turret_ruin', nexus: 's_nexus_ruin' };

/** 미니언 종류 → 소속 팀 */
const TEAM_OF: Partial<Record<Kind, TeamId>> = {
  push: 'push', pushR: 'push', dev: 'dev', devC: 'dev', biz: 'biz', bizC: 'biz', capPush: 'push', capDev: 'dev', capBiz: 'biz',
};
const teamOf = (k: Kind): TeamId => TEAM_OF[k] || 'dev';

const TEAM_COLOR: Record<TeamId, number> = { push: 0x3d8bff, dev: 0x00b7ff, biz: 0x00dc84 };
const TEAM_NAME: Record<TeamId, string> = { push: '추진팀', dev: '개발팀', biz: '사업팀' };

export class GameScene extends Phaser.Scene implements LaneHost {
  grid!: NavGrid;
  units: Unit[] = [];
  player!: Unit;
  lanesMgr!: LaneManager;
  projectiles: Projectile[] = [];
  structures = new Map<string, Unit>();
  boss: Unit | null = null;

  private simTime = 0;
  private cinematic = false;
  private unsubs: (() => void)[] = [];
  private hudTimer = 0;

  // 플레이어 상태
  private level = 1;
  private xp = 0;
  private path: Pt[] = [];
  private attackTarget: Unit | null = null;
  private repathTimer = 0;
  private cd: Record<SkillKey, number> = { q: 0, w: 0, r: BALANCE.skills.r.initialCooldown };
  private dead = false;
  private respawnAt = 0;
  private castAnim = 0;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private pointerHeld = false;
  private lastDrag = 0;
  private faceImg: Phaser.GameObjects.Image | null = null;
  private targetRing!: Phaser.GameObjects.Image;
  private aimGfx!: Phaser.GameObjects.Graphics;

  // 보스 상태
  private bossState = { timer: 2, idx: 0, support: false, ultUsed: false, melee: 0, floorHintAt: 0 };
  private bossDefeated = false;
  private firstTurretDone = false;
  private resumeNexus = false;
  captains: Record<TeamId, Unit> = {} as Record<TeamId, Unit>;
  private greetedCaptains = new Set<TeamId>();
  private passiveTimer = 0;
  private ultBusy = false;

  private gates = new Map<string, Phaser.GameObjects.GameObject[]>();
  private shields = new Map<string, Phaser.GameObjects.Image>();
  private memories: { id: string; label: string; pos: Pt; objs: Phaser.GameObjects.GameObject[]; taken: boolean }[] = [];
  private bubbles: { obj: Phaser.GameObjects.Container; unit: Unit; until: number }[] = [];
  private dmgTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Game');
  }

  /* ════════════════════════ 생성 ════════════════════════ */
  create(data: { resume?: boolean }) {
    this.resetFields();
    this.grid = new NavGrid();
    this.buildMap();

    this.aimGfx = this.add.graphics().setDepth(4000);
    this.targetRing = this.add.image(0, 0, 'fx_ring').setTint(0xff3b5c).setAlpha(0).setDepth(2);

    this.createStructures();
    this.createPlayer();
    this.lanesMgr = new LaneManager(this);
    this.createCaptains();
    this.createMemories();
    this.createSigns();

    // 저장된 진행 복원
    const prog = data?.resume ? save.data.progress : null;
    if (prog) this.restoreProgress(prog);
    else save.update((d) => ((d.stage = 'lane'), (d.progress = { destroyed: [], level: 1, xp: 0, bossDefeated: false })));

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.w, WORLD.h);
    cam.startFollow(this.player.view, true, 0.12, 0.12);
    cam.centerOn(this.player.x, this.player.y);
    this.applyZoom();

    this.setupInput();
    this.unsubs.push(
      bus.on('resize', () => this.applyZoom()),
      bus.on('skill', (k: SkillKey) => this.castSkill(k)),
      bus.on('state', ({ prev, next }) => this.onState(prev, next)),
      bus.on('minimap:tap', (p: Pt) => this.moveTo(p)),
    );
    bus.emit('minimap:source', () => this.minimapData());
    this.events.once('shutdown', () => this.cleanup());
    this.summonEffect(this.player.x, this.player.y);
    this.pushHud(true);
  }

  private resetFields() {
    this.units = [];
    this.projectiles = [];
    this.structures = new Map();
    this.boss = null;
    this.simTime = 0;
    this.cinematic = false;
    this.unsubs = [];
    this.level = 1;
    this.xp = 0;
    this.path = [];
    this.attackTarget = null;
    this.cd = { q: 0, w: 0, r: BALANCE.skills.r.initialCooldown };
    this.dead = false;
    this.castAnim = 0;
    this.faceImg = null;
    this.bossState = { timer: 2, idx: 0, support: false, ultUsed: false, melee: 0, floorHintAt: 0 };
    this.bossDefeated = false;
    this.firstTurretDone = false;
    this.resumeNexus = false;
    this.captains = {} as Record<TeamId, Unit>;
    this.greetedCaptains = new Set();
    this.passiveTimer = 0;
    this.ultBusy = false;
    this.gates = new Map();
    this.shields = new Map();
    this.memories = [];
    this.bubbles = [];
    this.dmgTexts = [];
  }

  private cleanup() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.input.removeAllListeners();
    bus.emit('minimap:source', null);
  }

  private applyZoom() {
    const dpr = (this.game.registry.get('dpr') as number) || 1;
    const w = this.scale.width / dpr,
      h = this.scale.height / dpr;
    // 세로 화면 기준 약 520px 폭이 보이도록, 가로/데스크톱은 상한 적용
    const z = Phaser.Math.Clamp(Math.min(w, h) / 580, 0.55, 1.3);
    this.cameras.main.setZoom(z * dpr);
  }

  private buildMap() {
    const src = (k: string) => (this.textures.exists(k) ? (this.textures.get(k).getSourceImage() as CanvasImageSource) : undefined);
    const grass = this.textures.exists('tile_grass') ? src('tile_grass') : undefined;
    const cv = paintMap(this.grid, 1, { grass, pine: src('deco_pine'), group: src('deco_group') });
    const n = 3,
      size = WORLD.w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const key = `map_${i}_${j}`;
        if (this.textures.exists(key)) this.textures.remove(key);
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        c.getContext('2d')!.drawImage(cv, i * size, j * size, size, size, 0, 0, size, size);
        this.textures.addCanvas(key, c);
        this.add.image(i * size, j * size, key).setOrigin(0).setDepth(0);
      }
    // 미니맵용 축소판
    const mini = document.createElement('canvas');
    mini.width = 240;
    mini.height = 240;
    mini.getContext('2d')!.drawImage(cv, 0, 0, 240, 240);
    bus.emit('minimap:bg', mini);
  }

  /* ════════════════════════ 개체 생성 ════════════════════════ */
  private makeUnit(kind: Kind, side: Side, x: number, y: number, hp: number): Unit {
    const v = KIND_VIEW[kind];
    const u = new Unit(this, {
      side, kind, x, y, hp, radius: v.r, texture: v.tex, displayH: v.h, hpWidth: v.hpW, hpY: v.hpY, shadowW: v.shadowW,
    });
    u.anim = v.anim || null;
    u.normFrames = !!v.norm;
    this.units.push(u);
    return u;
  }

  private applyStats(u: Unit, s: UnitStats, hpMult = 1) {
    u.hp = u.maxHp = Math.round(s.hp * hpMult);
    u.damage = s.damage;
    u.interval = s.interval;
    u.range = s.range;
    u.speed = s.speed * (0.95 + Math.random() * 0.1);
    u.armor = s.armor;
    u.aggro = s.aggro;
  }

  private createPlayer() {
    const P = BALANCE.player;
    const u = this.makeUnit('player', 'ally', ALLY_BASE.x + 60, ALLY_BASE.y - 60, P.hp);
    u.damage = P.attack;
    u.interval = P.attackInterval;
    u.range = P.attackRange;
    u.speed = P.speed;
    u.aggro = P.autoAcquireRange;
    u.setHpColor(0x00dc84);
    this.player = u;
    if (this.textures.exists('champion_face')) {
      const k = KIND_VIEW.player.h / FACE_ANCHOR.h;
      const size = FACE_ANCHOR.r * 2 * k;
      this.faceImg = this.add.image(0, (FACE_ANCHOR.y - 0.92 * FACE_ANCHOR.h) * k, 'champion_face').setDisplaySize(size, size);
      u.view.add(this.faceImg);
    }
    // 이름표
    const name = gameText(this, 0, -128, runtime.assets.champion.name, 'champion');
    u.view.add(name);
  }

  private createStructures() {
    const S = BALANCE.structures;
    for (const l of LANES) {
      const t = this.makeUnit('turret', 'enemy', l.enemyTurret.x, l.enemyTurret.y, S.enemyTurret.hp);
      t.isStructure = true;
      t.damage = S.enemyTurret.damage;
      t.interval = S.enemyTurret.interval;
      t.range = S.enemyTurret.range;
      t.structId = `${l.id}_turret`;
      this.structures.set(t.structId, t);
      this.grid.setCircleBlocked(t, 44, true);
      this.addRangeRing(t, 0xff3b5c);

      const i = this.makeUnit('inhibitor', 'enemy', l.inhibitor.x, l.inhibitor.y, S.inhibitor.hp);
      i.isStructure = true;
      i.invulnerable = true;
      i.structId = `${l.id}_inhib`;
      this.structures.set(i.structId, i);
      this.grid.setCircleBlocked(i, 34, true);
      this.addShield(i.structId, i, 1.3);

      const a = this.makeUnit('allyTurret', 'ally', l.allyTurret.x, l.allyTurret.y, 9999);
      a.isStructure = true;
      a.invulnerable = true;
      a.damage = S.allyTurret.damage;
      a.interval = S.allyTurret.interval;
      a.range = S.allyTurret.range;
      this.grid.setCircleBlocked(a, 40, true);

      this.createGate(l.id, l.gate, l.gateAngle);
    }
    FIREWALLS.forEach((p, k) => {
      const f = this.makeUnit('firewall', 'enemy', p.x, p.y, S.firewall.hp);
      f.isStructure = true;
      f.damage = S.firewall.damage;
      f.interval = S.firewall.interval;
      f.range = S.firewall.range;
      f.structId = `fw_${k}`;
      f.invulnerable = true; // 넥서스 공략 단계에서 활성화
      this.structures.set(f.structId, f);
      this.grid.setCircleBlocked(f, 26, true);
    });
    const nx = this.makeUnit('nexus', 'enemy', ENEMY_NEXUS.x, ENEMY_NEXUS.y, S.nexus.hp);
    nx.isStructure = true;
    nx.invulnerable = true;
    nx.structId = 'nexus';
    this.structures.set('nexus', nx);
    this.grid.setCircleBlocked(nx, 70, true);
    this.addShield('nexus', nx, 2.4);
    const glow = this.add.image(0, -110, 'fx_glow').setTint(0xb06bff).setAlpha(0.5).setScale(2.2).setBlendMode('ADD');
    nx.view.addAt(glow, 1);
    this.tweens.add({ targets: glow, alpha: 0.25, scale: 2.5, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });

    const an = this.makeUnit('allyNexus', 'ally', ALLY_NEXUS.x, ALLY_NEXUS.y, 99999);
    an.isStructure = true;
    an.invulnerable = true;
    an.damage = 260;
    an.interval = 0.8;
    an.range = 340;
    this.grid.setCircleBlocked(an, 60, true);
    const g2 = this.add.image(0, -90, 'fx_glow').setTint(0x00b7ff).setAlpha(0.45).setScale(1.9).setBlendMode('ADD');
    an.view.addAt(g2, 1);
    this.tweens.add({ targets: g2, alpha: 0.2, yoyo: true, repeat: -1, duration: 1600 });
  }

  private addRangeRing(u: Unit, color: number) {
    const ring = this.add.image(u.x, u.y, 'fx_ring').setTint(color).setAlpha(0.18).setDepth(1);
    ring.setDisplaySize(u.range * 2, u.range * 2 * 0.62);
    u.extra.push(ring);
  }

  private addShield(id: string, u: Unit, scale: number) {
    const s = this.add.image(0, -u.displayH * 0.45, 'fx_hex').setTint(0xb06bff).setAlpha(0.55).setScale(scale).setBlendMode('ADD');
    u.view.add(s);
    this.tweens.add({ targets: s, alpha: 0.3, yoyo: true, repeat: -1, duration: 1100 });
    this.shields.set(id, s);
  }

  private removeShield(id: string) {
    const s = this.shields.get(id);
    if (!s) return;
    this.shields.delete(id);
    this.tweens.killTweensOf(s);
    this.tweens.add({ targets: s, alpha: 0, scale: s.scale * 1.4, duration: 500, onComplete: () => s.destroy() });
  }

  private createGate(id: string, p: Pt, angle: number) {
    const len = 210;
    const dx = Math.cos(angle) * (len / 2),
      dy = Math.sin(angle) * (len / 2);
    const g = this.add.graphics().setDepth(p.y);
    const draw = () => {
      g.clear();
      g.lineStyle(26, 0x6f36ff, 0.25);
      g.lineBetween(p.x - dx, p.y - dy, p.x + dx, p.y + dy);
      g.lineStyle(10, 0xb06bff, 0.6);
      g.lineBetween(p.x - dx, p.y - dy, p.x + dx, p.y + dy);
      g.lineStyle(3, 0xffffff, 0.8);
      g.lineBetween(p.x - dx, p.y - dy, p.x + dx, p.y + dy);
    };
    draw();
    this.tweens.add({ targets: g, alpha: 0.55, yoyo: true, repeat: -1, duration: 700 });
    const p1 = this.add.image(p.x - dx, p.y - dy + 20, 'firewall').setScale(0.42).setOrigin(0.5, 0.9).setDepth(p.y - dy);
    const p2 = this.add.image(p.x + dx, p.y + dy + 20, 'firewall').setScale(0.42).setOrigin(0.5, 0.9).setDepth(p.y + dy);
    const label = gameText(this, p.x, p.y - 34, '보안 장벽', 'gate').setDepth(p.y + 1);
    this.gates.set(id, [g, p1, p2, label]);
    this.grid.setCircleBlocked(p, 104, true);
  }

  private openGate(id: string, silent = false) {
    const objs = this.gates.get(id);
    if (!objs) return;
    this.gates.delete(id);
    const lane = LANES.find((l) => l.id === id)!;
    this.grid.setCircleBlocked(lane.gate, 104, false);
    for (const o of objs) {
      this.tweens.killTweensOf(o);
      if (silent) o.destroy();
      else this.tweens.add({ targets: o, alpha: 0, duration: 800, onComplete: () => o.destroy() });
    }
    if (!silent) for (let i = 0; i < 14; i++) this.pixelBurst(lane.gate.x + (Math.random() - 0.5) * 160, lane.gate.y + (Math.random() - 0.5) * 60, 0xb06bff);
  }

  private createSigns() {
    // 아군 본진 깃발
    if (this.textures.exists('deco_banner'))
      for (const p of [{ x: 140, y: 1880 }, { x: 520, y: 2230 }, { x: 560, y: 1860 }]) {
        this.add.image(p.x, p.y, 'deco_banner').setOrigin(0.5, 0.95).setScale(110 / 260).setDepth(p.y);
      }
    for (const l of LANES) {
      gameText(this, l.sign.x, l.sign.y, `${l.label} · ${l.teamName}`, 'sign', { color: TEAM_TEXT[l.team] }).setDepth(3);
    }
  }

  private createMemories() {
    for (const m of MEMORY_SPOTS) {
      const tex = m.kind === 'box' ? 'memory_box' : m.kind === 'orb' ? 'memory_orb' : 'memory_monument';
      const taken = save.data.unlocked.includes(m.id);
      const glow = this.add.image(m.pos.x, m.pos.y - 20, 'fx_glow').setTint(0xffe28a).setScale(1.3).setAlpha(taken ? 0.15 : 0.6).setBlendMode('ADD').setDepth(m.pos.y - 1);
      const img = this.add.image(m.pos.x, m.pos.y, tex).setOrigin(0.5, 0.9).setScale(0.5).setDepth(m.pos.y);
      if (taken) img.setAlpha(0.55);
      else {
        this.tweens.add({ targets: img, y: m.pos.y - 8, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: glow, alpha: 0.3, scale: 1.6, yoyo: true, repeat: -1, duration: 1200 });
      }
      this.memories.push({ id: m.id, label: m.label, pos: m.pos, objs: [img, glow], taken });
    }
  }

  /** LaneHost: 라인 미니언 생성 */
  spawnLaneUnit(lane: LaneRuntime, kind: Kind, s: number, empowered: boolean): Unit | null {
    const p = lane.point(s);
    const jitter = () => (Math.random() - 0.5) * 30;
    const side: Side = TEAM_OF[kind] ? 'ally' : 'enemy';
    const u = this.makeUnit(kind, side, p.x + jitter(), p.y + jitter(), 1);
    const stats = side === 'ally' ? (BALANCE.allyUnits as any)[kind] : (BALANCE.enemyUnits as any)[kind];
    this.applyStats(u, stats, empowered ? BALANCE.enemyUnits.empoweredHpMult : 1);
    u.lane = lane;
    u.s = s;
    if (kind === 'ransomware') u.specialTimer = 2.5;
    if (empowered && side === 'enemy') u.sprite.setTint(0xffb3c6);
    u.refreshHp();
    return u;
  }

  /* ─────────── 팀장 NPC (Ally Captain) ─────────── */
  /** 라인당 1명의 고유 인스턴스. 미니언 AI(updateMinion)를 그대로 재사용 */
  private createCaptains() {
    for (const team of ['push', 'dev', 'biz'] as TeamId[]) {
      const def = CAPTAIN_DEFS[team];
      const lane = this.lanesMgr.byId(def.lane);
      const s0 = lane.sAllyTurret + 60;
      const p0 = lane.point(s0);
      const u = this.makeUnit(CAPTAIN_KIND[team], 'ally', p0.x, p0.y, 1);
      this.applyStats(u, BALANCE.captains[team]);
      u.speed = BALANCE.captains[team].speed;
      u.captain = true;
      u.lane = lane;
      u.s = s0;
      u.setHpColor(0x3d9bff);
      u.refreshHp();
      // 이름표 + 패시브 범위 표시
      const tag = gameText(this, 0, -108, def.name, 'captain');
      const aura = this.add.image(0, 2, 'fx_ring').setTint(TEAM_COLOR[team]).setAlpha(0.28);
      aura.setDisplaySize(BALANCE.captains.passiveRadius * 2, BALANCE.captains.passiveRadius * 1.24);
      u.view.addAt(aura, 0);
      u.view.add(tag);
      this.tweens.add({ targets: aura, alpha: 0.12, yoyo: true, repeat: -1, duration: 1300 });
      this.captains[team] = u;
    }
  }

  /** 체력이 낮으면 아군 포탑 쪽으로 후퇴해 회복 후 복귀 (보스전 중에는 후퇴하지 않음) */
  private captainRetreat(u: Unit, dt: number) {
    const C = BALANCE.captains;
    const st = u as any;
    const inBoss = !!(this.boss && this.boss.alive);
    if (!st.retreating && !inBoss && u.hp < u.maxHp * C.retreatAt) {
      st.retreating = true;
      u.target = null;
      if (this.onScreen(u.x, u.y)) this.floatText(u.x, u.y - 110, '재정비!', '#9fdcff', 14);
    }
    if (!st.retreating) return false;
    const lane = u.lane!;
    const safeS = lane.sAllyTurret;
    const P = lane.point(Math.max(0, safeS));
    if (Math.hypot(P.x - u.x, P.y - u.y) > 20) {
      this.moveToward(u, P.x, P.y, dt);
      u.s = lane.poly.project(u);
    } else {
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * C.retreatRegen * dt);
      u.refreshHp();
      if (u.hp >= u.maxHp * C.retreatUntil) st.retreating = false;
    }
    return true;
  }

  /** 팀장의 전진 한계: 부장님이 다음 적 구조물 근처에 없으면 포탑 사거리 밖에서 대기 */
  private captainStopS(lane: LaneRuntime) {
    const nextS = lane.turretAlive ? lane.sEnemyTurret : lane.inhibAlive ? lane.sInhib : -1;
    if (nextS < 0) return lane.allyStopS;
    const pos = lane.point(nextS);
    const assist = !this.dead && Math.hypot(this.player.x - pos.x, this.player.y - pos.y) < BALANCE.captains.structureAssistRange;
    return assist ? lane.allyStopS : Math.min(lane.allyStopS, nextS - BALANCE.structures.enemyTurret.range - 60);
  }

  private captainDown(u: Unit) {
    u.alive = false;
    u.hp = 0;
    u.refreshHp();
    (u as any).retreating = false;
    u.target = null;
    u.respawnAt = this.simTime + BALANCE.captains.respawnSeconds;
    u.rootUntil = 0;
    u.slowUntil = 0;
    const team = teamOf(u.kind);
    if (this.onScreen(u.x, u.y)) {
      // 쓰러짐 → 빛과 함께 본진 귀환
      u.view.setVisible(true);
      u.setTex(`cap_${team}_down`);
      u.sprite.clearTint();
      this.time.delayedCall(700, () => {
        if (u.alive) return;
        this.lightPillar(u.x, u.y, TEAM_COLOR[team]);
        this.tweens.add({ targets: u.view, alpha: 0, duration: 400 });
      });
    } else u.view.setAlpha(0);
    this.floatText(u.x, u.y - 110, `${CAPTAIN_DEFS[team].name} 귀환 (${BALANCE.captains.respawnSeconds}초 후 복귀)`, '#9fdcff', 14);
  }

  private captainRespawn(u: Unit) {
    const lane = u.lane!;
    const p0 = lane.point(0);
    u.alive = true;
    u.hp = u.maxHp;
    u.refreshHp();
    u.s = 0;
    u.x = p0.x;
    u.y = p0.y;
    u.target = null;
    u.hitFlash = 0;
    u.attackAnim = 0;
    this.tweens.killTweensOf(u.view);
    u.view.setAlpha(1).setPosition(u.x, u.y);
    if (this.onScreen(u.x, u.y)) {
      const team = teamOf(u.kind);
      this.playFrames(u.x, u.y + 8, [`cap_${team}_revive`], { height: 110, hold: 300, depth: u.y + 1, originY: 0.95 });
      this.lightPillar(u.x, u.y, TEAM_COLOR[team]);
    }
  }

  /** 부활 타이머, 화면 밖 라인 대기, 패시브 갱신 */
  private updateCaptains(dt: number) {
    const C = BALANCE.captains;
    for (const team of ['push', 'dev', 'biz'] as TeamId[]) {
      const u = this.captains[team];
      if (!u) continue;
      if (!u.alive) {
        if (this.simTime >= u.respawnAt) this.captainRespawn(u);
        continue;
      }
      const lane = u.lane!;
      if (!lane.active) {
        // 경량 계산: 전선 뒤에서 대기하며 체력 회복 (HP·부활 상태는 그대로 유지)
        const s = Math.max(0, Math.min(lane.front - 90, lane.allyStopS));
        const p = lane.point(s);
        u.s = s;
        u.x = p.x;
        u.y = p.y;
        u.moving = false;
        u.target = null;
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * C.dormantRegen * dt);
        u.refreshHp();
      }
    }
    // 패시브: 0.25초마다 범위 판정 (중첩 없이 on/off)
    this.passiveTimer -= dt;
    if (this.passiveTimer > 0) return;
    this.passiveTimer = 0.25;
    const R = C.passiveRadius;
    const caps = (['push', 'dev', 'biz'] as TeamId[]).map((t) => [t, this.captains[t]] as const).filter(([, c]) => c && c.alive && c.lane?.active);
    for (const u of this.units) {
      if (!u.alive || u.side !== 'ally' || u.isStructure) continue;
      u.buffDef = u.buffAs = u.buffTower = false;
      if (u === this.player && this.dead) continue;
      for (const [t, c] of caps) {
        if (u.dist(c) > R) continue;
        if (t === 'push') u.buffDef = true;
        else if (t === 'dev') u.buffAs = true;
        else u.buffTower = true;
      }
    }
  }

  /** 궁극기/지원 이벤트용 아군 미니언 */
  private spawnRally(team: TeamId, angle: number, duration: number) {
    const r = 120;
    const pos = { x: this.player.x + Math.cos(angle) * r, y: this.player.y + Math.sin(angle) * r };
    const u = this.makeUnit(team, 'ally', pos.x, pos.y, 1);
    this.applyStats(u, BALANCE.allyUnits[team], 1.3);
    u.rally = true;
    u.rallyAngle = angle;
    u.expireAt = this.simTime + duration;
    u.refreshHp();
    this.lightPillar(pos.x, pos.y, TEAM_COLOR[team]);
    const tag = gameText(this, 0, -80, TEAM_NAME[team], 'rally');
    u.view.add(tag);
    return u;
  }

  removeUnitQuiet(u: Unit) {
    u.alive = false;
    u.destroyView();
  }

  enemyWavesEnabled() {
    const s = fsm.baseState;
    return s !== GameState.BOSS_BATTLE && s !== GameState.NEXUS_BATTLE && !this.bossDefeated;
  }

  /* ════════════════════════ 입력 ════════════════════════ */
  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!fsm.isRunning || this.cinematic || this.dead) return;
      this.pointerHeld = true;
      this.lastDrag = this.simTime;
      this.handleTap(p.worldX, p.worldY, true);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.pointerHeld || !p.isDown || !fsm.isRunning || this.cinematic || this.dead) return;
      if (this.simTime - this.lastDrag < 0.16) return;
      this.lastDrag = this.simTime;
      this.handleTap(p.worldX, p.worldY, false);
    });
    this.input.on('pointerup', () => (this.pointerHeld = false));
    this.input.on('pointerupoutside', () => (this.pointerHeld = false));

    const kb = this.input.keyboard;
    if (kb) {
      for (const k of ['Q', 'W', 'R', 'E', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ESC', 'ONE', 'TWO', 'THREE']) {
        this.keys[k] = kb.addKey(k, false, false);
      }
      kb.on('keydown-Q', () => this.castSkill('q'));
      kb.on('keydown-W', () => this.castSkill('w'));
      kb.on('keydown-E', () => this.castSkill('w'));
      kb.on('keydown-R', () => this.castSkill('r'));
      kb.on('keydown-ESC', () => bus.emit('ui:pause'));
    }
  }

  private handleTap(x: number, y: number, isTap: boolean) {
    bus.emit('tut:moved');
    if (isTap) {
      const t = this.pickEnemy(x, y);
      if (t) {
        this.attackTarget = t;
        this.path = [];
        this.repathTimer = 0;
        this.tapMarker(t.x, t.y, 0xff3b5c);
        bus.emit('tut:attacked');
        return;
      }
    }
    this.attackTarget = null;
    this.moveTo({ x, y }, isTap);
  }

  private moveTo(p: Pt, marker = true) {
    if (this.dead || !fsm.isRunning) return;
    const path = this.grid.findPath(this.player, p);
    if (!path || !path.length) return;
    this.path = path;
    if (marker) {
      const end = path[path.length - 1];
      this.tapMarker(end.x, end.y, 0x00dc84);
    }
  }

  private pickEnemy(x: number, y: number): Unit | null {
    let best: Unit | null = null,
      bd = Infinity;
    for (const u of this.units) {
      if (!u.alive || u.side !== 'enemy') continue;
      const cy = u.isStructure ? u.y - u.radius * 0.8 : u.y - 18;
      const d = Math.hypot(u.x - x, cy - y);
      const pick = u.radius + (u.isStructure ? 30 : 34);
      if (d < pick && d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  /* ════════════════════════ 메인 루프 ════════════════════════ */
  update(_time: number, deltaMs: number) {
    if (!this.cameras?.main || !this.player) return; // 종료 중인 씬 보호
    const dt = Math.min(deltaMs, 50) / 1000;
    this.updateViews();
    if (!fsm.isRunning || this.cinematic) return;
    if (this.resumeNexus) {
      this.resumeNexus = false;
      this.startNexusPhase();
    }
    this.simTime += dt;

    this.updatePlayer(dt);
    for (const u of this.units) {
      if (!u.alive || u === this.player) continue;
      if (u.isStructure) this.updateStructure(u, dt);
      else if (u.kind === 'boss') this.updateBoss(u, dt);
      else if (u.captain && u.lane && !u.lane.active) continue; // 화면 밖 라인: 상태만 유지
      else this.updateMinion(u, dt);
    }
    this.updateProjectiles(dt);
    this.lanesMgr.update(dt);
    this.updateCaptains(dt);
    this.checkMemories();
    this.checkProgressTriggers();
    this.updateBubbles();
    this.drawAimLines();

    // 죽은 개체 정리
    if (this.units.some((u) => !u.alive)) this.units = this.units.filter((u) => u.alive || u === this.player || u.captain || (u.isStructure && u.kind !== 'boss'));

    for (const k of ['q', 'w', 'r'] as SkillKey[]) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.pushHud();
    }
  }

  /* ─────────── 플레이어 ─────────── */
  private updatePlayer(dt: number) {
    const p = this.player;
    const P = BALANCE.player;
    if (this.dead) {
      if (this.simTime >= this.respawnAt) this.respawn();
      return;
    }
    this.castAnim = Math.max(0, this.castAnim - dt);
    const rooted = p.rootUntil > this.simTime;
    const slow = p.slowUntil > this.simTime ? p.slowMult : 1;

    // 키보드 이동(선택)
    let kx = 0,
      ky = 0;
    if (this.keys.LEFT?.isDown) kx -= 1;
    if (this.keys.RIGHT?.isDown) kx += 1;
    if (this.keys.UP?.isDown) ky -= 1;
    if (this.keys.DOWN?.isDown) ky += 1;
    if (kx || ky) {
      this.path = [];
      this.attackTarget = null;
    }

    // 회복
    const atFountain = Math.hypot(p.x - ALLY_BASE.x, p.y - ALLY_BASE.y) < 230;
    if (atFountain) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * P.fountainHealPerSec * dt);
    else if (this.simTime - p.lastHitAt > 4) p.hp = Math.min(p.maxHp, p.hp + P.regenPerSec * dt);
    p.refreshHp();

    p.moving = false;
    // 공격 대상 유효성
    if (this.attackTarget && (!this.attackTarget.alive || this.attackTarget.invulnerable)) this.attackTarget = null;
    let target = this.attackTarget;
    if (!target && !this.path.length && !kx && !ky) target = this.findTargetFor(p, P.autoAcquireRange);

    if (rooted) {
      // 이동 불가, 공격만 가능
    } else if (kx || ky) {
      const len = Math.hypot(kx, ky);
      this.stepPlayer((kx / len) * p.speed * slow * dt, (ky / len) * p.speed * slow * dt);
    } else if (this.attackTarget && target === this.attackTarget) {
      const d = p.dist(target) - target.radius;
      if (d > p.range) {
        this.repathTimer -= dt;
        if (this.repathTimer <= 0 || !this.path.length) {
          this.repathTimer = 0.35;
          const ang = Math.atan2(p.y - target.y, p.x - target.x);
          const goal = { x: target.x + Math.cos(ang) * (target.radius + p.range * 0.8), y: target.y + Math.sin(ang) * (target.radius + p.range * 0.8) };
          this.path = this.grid.findPath(p, goal) || [];
        }
        this.followPath(p.speed * slow * dt);
      } else this.path = [];
    } else if (this.path.length) {
      this.followPath(p.speed * slow * dt);
    }

    p.atkTimer -= dt;
    if (target && target.alive && !p.moving) {
      const d = p.dist(target) - target.radius;
      if (d <= p.range) {
        p.facing = target.x >= p.x ? 1 : -1;
        if (p.atkTimer <= 0) {
          p.atkTimer = p.interval * (p.buffAs ? BALANCE.captains.devAttackInterval : 1);
          p.attackAnim = 0.22;
          audio.play('attack');
          this.fireProjectile(p, target, p.damage, 'player');
        }
      }
    }
  }

  private stepPlayer(dx: number, dy: number) {
    const p = this.player;
    const nx = p.x + dx,
      ny = p.y + dy;
    if (this.grid.walkable({ x: nx, y: ny })) {
      p.x = nx;
      p.y = ny;
    } else if (this.grid.walkable({ x: nx, y: p.y })) p.x = nx;
    else if (this.grid.walkable({ x: p.x, y: ny })) p.y = ny;
    else return;
    if (Math.abs(dx) > 0.01) p.facing = dx > 0 ? 1 : -1;
    p.moving = true;
  }

  private followPath(step: number) {
    const p = this.player;
    while (step > 0 && this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - p.x,
        dy = wp.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= step) {
        p.x = wp.x;
        p.y = wp.y;
        this.path.shift();
        step -= d;
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
        step = 0;
      }
      if (Math.abs(dx) > 1) p.facing = dx > 0 ? 1 : -1;
      p.moving = true;
    }
  }

  private gainXp(n: number) {
    const X = BALANCE.xp;
    if (this.level >= X.maxLevel) return;
    this.xp += n;
    while (this.level < X.maxLevel && this.xp >= X.levels[this.level]) {
      this.level++;
      const P = BALANCE.player;
      this.player.maxHp += P.hpPerLevel;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + P.hpPerLevel + this.player.maxHp * 0.25);
      this.player.damage += P.attackPerLevel;
      audio.play('levelup');
      bus.emit('banner', { text: `LEVEL UP! Lv.${this.level}`, kind: 'level' });
      this.shockwave(this.player.x, this.player.y, 0xffe28a, 160, 600);
      this.lightPillar(this.player.x, this.player.y, 0xffe28a);
      this.saveProgress();
    }
  }

  private playerDied() {
    const p = this.player;
    this.dead = true;
    p.alive = false;
    p.hp = 0;
    this.respawnAt = this.simTime + BALANCE.player.respawnSeconds;
    this.path = [];
    this.attackTarget = null;
    this.lightPillar(p.x, p.y, 0x00b7ff);
    this.tweens.add({ targets: p.view, alpha: 0, duration: 500 });
    bus.emit('player:dead', BALANCE.player.respawnSeconds);
  }

  private respawn() {
    const p = this.player;
    this.dead = false;
    p.alive = true;
    p.hp = p.maxHp;
    p.x = ALLY_BASE.x + 60;
    p.y = ALLY_BASE.y - 60;
    p.view.setPosition(p.x, p.y);
    p.rootUntil = 0;
    p.slowUntil = 0;
    this.tweens.killTweensOf(p.view);
    p.view.setAlpha(1);
    this.cameras.main.centerOn(p.x, p.y);
    this.summonEffect(p.x, p.y);
    bus.emit('player:respawn');
    bus.emit('toast', 'GAME MASTER 재소환 완료! 레벨과 진행 상황은 그대로입니다.');
  }

  /* ─────────── 스킬 ─────────── */
  private castSkill(k: SkillKey) {
    if (!fsm.isRunning || this.cinematic || this.dead) return;
    if (this.cd[k] > 0) return;
    if (k === 'r' && this.ultBusy) return;
    const S = BALANCE.skills;
    const p = this.player;
    bus.emit('tut:skill');
    if (k === 'q') {
      this.cd.q = S.q.cooldown;
      const t = this.attackTarget || this.findTargetFor(p, 420);
      const ang = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.facing > 0 ? 0 : Math.PI;
      p.facing = Math.cos(ang) >= 0 ? 1 : -1;
      this.castAnim = 0.35;
      p.attackAnim = 0.25;
      audio.play('q');
      this.coneFx(p.x, p.y - 20, ang, S.q.range, S.q.coneDeg);
      const half = Phaser.Math.DegToRad(S.q.coneDeg / 2);
      const dmg = S.q.damage + S.q.damagePerLevel * (this.level - 1);
      for (const u of this.units) {
        if (!u.alive || u.side !== 'enemy' || u.invulnerable) continue;
        const d = p.dist(u) - u.radius;
        if (d > S.q.range) continue;
        const a = Math.atan2(u.y - p.y, u.x - p.x);
        if (Math.abs(Phaser.Math.Angle.Wrap(a - ang)) > half && d > 30) continue;
        this.dealDamage(u, u.isStructure ? dmg * S.q.structureMult : dmg, p);
        this.hitSpark(u.x, u.y - 20, 0x00b7ff);
      }
    } else if (k === 'w') {
      this.cd.w = S.w.cooldown;
      this.castAnim = 0.35;
      audio.play('w');
      const until = this.simTime + S.w.duration;
      for (const u of this.units) {
        if (!u.alive || u.side !== 'ally' || u.isStructure) continue;
        if (u !== p && p.dist(u) > S.w.radius) continue;
        u.shieldUntil = until;
        u.hp = Math.min(u.maxHp, u.hp + S.w.heal);
        u.refreshHp();
        this.attachShieldFx(u, S.w.duration);
      }
      this.shockwave(p.x, p.y, 0x00b7ff, S.w.radius, 500);
      this.playFrames(p.x, p.y + 10, ['fx_w_0', 'fx_w_1', 'fx_w_2', 'fx_w_3'], { height: 150, frameMs: 90, depth: p.y + 5, originY: 0.9 });
      this.playFrames(p.x + 30, p.y - 120, ['fx_w_icon'], { height: 60, hold: 400 });
      this.floatText(p.x, p.y - 140, '보안 강화!', '#9fdcff', 18);
    } else {
      this.castUlt();
    }
    this.pushHud();
  }

  /**
   * R 전 부서 집결!
   * 0.0s 메시지 → 0.35/0.75/1.15s 추진·개발·사업팀장 등장(시각적 분신) + 대표 미니언 합류
   * → 1.7s 합동 공격 → 3.6s 분신 퇴장. 실제 팀장 인스턴스는 각 라인에 그대로 유지.
   */
  private castUlt() {
    if (this.ultBusy) return;
    this.ultBusy = true;
    const S = BALANCE.skills.r;
    const p = this.player;
    this.cd.r = S.cooldown;
    this.castAnim = 1.0;
    audio.play('r');
    audio.voice('voice_summon');
    const teams: TeamId[] = ['push', 'dev', 'biz'];
    bus.emit('ult', { lines: teams.map((t) => CAPTAIN_DEFS[t].rallyLine) });
    const inBoss = !!(this.boss && this.boss.alive);
    this.shockwave(p.x, p.y, 0xffe28a, 260, 700);
    this.playFrames(p.x, p.y + 20, ['fx_r_0', 'fx_r_1', 'fx_r_2', 'fx_r_3'], { height: 230, frameMs: 170, hold: 500, depth: p.y + 5, originY: 0.85 });
    this.cameras.main.flash(250, 255, 240, 200);

    const clones: Phaser.GameObjects.Container[] = [];
    const spots = [Math.PI * 0.9, Math.PI * 0.5, Math.PI * 0.1]; // 좌측·전방·우측
    const existing = this.units.filter((u) => u.alive && u.rally).length;
    teams.forEach((team, i) => {
      this.time.delayedCall(350 + i * 400, () => {
        if (!this.scene.isActive()) return;
        const a = spots[i];
        const x = p.x + Math.cos(a) * 130,
          y = p.y + Math.sin(a) * 85;
        clones.push(this.captainClone(team, x, y));
        if (existing < 6)
          for (let k = 0; k < S.rallyCount; k++) this.spawnRally(team, a + (k ? 0.5 : -0.5), inBoss && this.bossState.support ? 9999 : S.rallyDuration);
      });
    });

    this.time.delayedCall(1700, () => {
      if (!this.scene.isActive()) return;
      const dmg = S.burstDamage + 60 * (this.level - 1);
      const pick = (x: number, y: number) => {
        if (this.boss && this.boss.alive && Math.hypot(this.boss.x - x, this.boss.y - y) < 750) return this.boss;
        let best: Unit | null = null,
          bd = 650;
        for (const o of this.units) {
          if (!o.alive || o.side !== 'enemy' || o.invulnerable) continue;
          const d = Math.hypot(o.x - x, o.y - y);
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        return best;
      };
      // 팀장 분신 합동 공격
      clones.forEach((c, i) => {
        const team = teams[i];
        const img = c.getAt(1) as Phaser.GameObjects.Image;
        if (this.textures.exists(`cap_${team}_atk_3`)) img.setTexture(`cap_${team}_atk_3`);
        const t = pick(c.x, c.y);
        if (t) {
          this.beam(c.x, c.y - 50, t.x, t.y - 50, TEAM_COLOR[team]);
          this.playFrames(t.x, t.y - 40, ['fx_q_hit'], { height: 120, hold: 200, add: true });
        }
      });
      // 대표 미니언 합동 공격
      for (const r of this.units.filter((u) => u.alive && u.rally)) {
        const t = pick(r.x, r.y);
        if (t) this.beam(r.x, r.y - 30, t.x, t.y - 40, TEAM_COLOR[teamOf(r.kind)]);
      }
      this.beam(p.x, p.y - 60, p.x, p.y - 400, 0xffe28a);
      for (const u of this.units) {
        if (!u.alive || u.side !== 'enemy' || u.invulnerable) continue;
        if (u.kind === 'boss') {
          if (p.dist(u) > 750) continue;
          if (this.bossState.support) this.bossState.ultUsed = true;
          this.dealDamage(u, dmg + u.maxHp * S.bossBonusRatio, p);
          this.glitchBurst(u.x, u.y - 60, 14);
        } else if (p.dist(u) < S.burstRadius) {
          this.dealDamage(u, u.isStructure ? dmg * 0.6 : dmg, p);
          this.hitSpark(u.x, u.y - 20, 0xffe28a);
        }
      }
      this.shockwave(p.x, p.y, 0xffffff, S.burstRadius, 600);
      this.shockwave(p.x, p.y, 0x00dc84, S.burstRadius * 0.7, 800);
      this.cameras.main.shake(400, 0.012);
      audio.play('explode');
    });

    this.time.delayedCall(3600, () => {
      for (const c of clones) {
        if (!c.active) continue;
        this.lightPillar(c.x, c.y, 0xffe28a);
        this.tweens.add({ targets: c, alpha: 0, duration: 350, onComplete: () => c.destroy() });
      }
      this.ultBusy = false;
    });
  }

  /** 집결 연출용 팀장 분신 (전투 판정 없음, 실제 팀장 상태와 무관) */
  private captainClone(team: TeamId, x: number, y: number) {
    const key = this.textures.exists(`cap_${team}_victory`) ? `cap_${team}_victory` : KIND_VIEW[CAPTAIN_KIND[team]].tex;
    const shadow = this.add.image(0, 0, 'fx_shadow').setDisplaySize(50, 20);
    const img = this.add.image(0, 4, key).setOrigin(0.5, 0.92);
    img.setScale(90 / img.height).setFlipX(x > this.player.x);
    const tag = gameText(this, 0, -114, CAPTAIN_DEFS[team].name, 'captain', { fontSize: '18px' });
    const c = this.add.container(x, y, [shadow, img, tag]).setDepth(y).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this.playFrames(x, y + 8, [`cap_${team}_revive`], { height: 120, hold: 150, depth: y + 1, originY: 0.95 });
    this.lightPillar(x, y, TEAM_COLOR[team]);
    this.shockwave(x, y, TEAM_COLOR[team], 120, 500);
    audio.play('summon');
    return c;
  }

  /* ─────────── 미니언 AI ─────────── */
  private findTargetFor(u: Unit, range: number): Unit | null {
    let best: Unit | null = null,
      bestScore = Infinity;
    for (const o of this.units) {
      if (!o.alive || o.side === u.side) continue;
      // 무적 구조물은 아군 쪽에서 공격 대상으로 삼지 않음 (적은 아군 포탑을 향해 공격)
      if (o.invulnerable && u.side === 'ally') continue;
      // 팀장 NPC는 부장님이 근처에 있을 때만 구조물 공격 (단독 공략 방지)
      if (u.captain && o.isStructure && (this.dead || this.player.dist(o) > BALANCE.captains.structureAssistRange)) continue;
      if (o.kind === 'player' && this.dead) continue;
      const d = u.dist(o) - o.radius;
      if (d > range) continue;
      // 유닛 우선, 구조물은 후순위
      const score = d + (o.isStructure ? 400 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return best;
  }

  private updateMinion(u: Unit, dt: number) {
    if (u.rally && this.simTime > u.expireAt) {
      this.lightPillar(u.x, u.y, TEAM_COLOR[teamOf(u.kind)]);
      this.removeUnitQuiet(u);
      return;
    }
    u.moving = false;
    if (u.captain && this.captainRetreat(u, dt)) return;
    u.atkTimer -= dt;
    u.scanTimer -= dt;
    if (u.scanTimer <= 0) {
      u.scanTimer = 0.3;
      const had = u.target;
      u.target = this.findTargetFor(u, u.lane ? u.aggro : u.rally ? 380 : 500);
      if (had && !u.target && u.lane) u.s = Math.max(u.s * 0 + u.lane.poly.project(u), 0);
    }
    const t = u.target;
    if (t && !t.alive) u.target = null;

    // 랜섬웨어: 주변 아군 속박
    if (u.kind === 'ransomware') {
      u.specialTimer -= dt;
      if (u.specialTimer <= 0 && t) {
        const R = BALANCE.enemyUnits.ransomware;
        u.specialTimer = R.lockEvery;
        this.ransomLock(u, R.lockRadius, R.lockTime);
      }
    }

    const rooted = u.rootUntil > this.simTime;
    if (u.target) {
      const tt = u.target;
      const d = u.dist(tt) - tt.radius;
      if (d <= u.range) {
        u.facing = tt.x >= u.x ? 1 : -1;
        if (u.atkTimer <= 0) {
          u.atkTimer = u.interval * (u.buffAs ? BALANCE.captains.devAttackInterval : 1);
          u.attackAnim = 0.18;
          this.minionAttack(u, tt);
        }
      } else if (!rooted) this.moveToward(u, tt.x, tt.y, dt);
      return;
    }
    if (rooted) return;
    if (u.rally) {
      const ang = u.rallyAngle + this.simTime * 0.4;
      const gx = this.player.x + Math.cos(ang) * 90,
        gy = this.player.y + Math.sin(ang) * 70;
      if (Math.hypot(gx - u.x, gy - u.y) > 20) this.moveToward(u, gx, gy, dt, 1.4);
      return;
    }
    if (u.lane) {
      const lane = u.lane;
      const dir = u.side === 'ally' ? 1 : -1;
      const stopS = u.side === 'ally' ? (u.captain ? this.captainStopS(lane) : lane.allyStopS) : 0;
      let P = lane.point(u.s);
      if (Math.hypot(P.x - u.x, P.y - u.y) < 16) {
        const canGo = dir > 0 ? u.s < stopS : u.s > stopS;
        if (canGo) {
          u.s += dir * u.speed * dt;
          P = lane.point(u.s);
        } else return;
      }
      this.moveToward(u, P.x, P.y, dt);
      return;
    }
    // 라인 없는 소환 개체(보스 소환 버그): 플레이어에게 접근
    if (!this.dead) this.moveToward(u, this.player.x, this.player.y, dt);
  }

  private moveToward(u: Unit, tx: number, ty: number, dt: number, mult = 1) {
    const slow = u.slowUntil > this.simTime ? u.slowMult : 1;
    const dx = tx - u.x,
      dy = ty - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = Math.min(d, u.speed * slow * mult * dt);
    let mx = (dx / d) * step,
      my = (dy / d) * step;
    // 같은 편끼리 겹침 방지
    for (const o of this.units) {
      if (o === u || !o.alive || o.isStructure || o.side !== u.side || o.kind === 'player') continue;
      const ox = u.x - o.x,
        oy = u.y - o.y;
      const od = Math.hypot(ox, oy);
      if (od > 0 && od < 22) {
        mx += (ox / od) * (22 - od) * 0.15;
        my += (oy / od) * (22 - od) * 0.15;
      }
    }
    u.x += mx;
    u.y += my;
    if (Math.abs(dx) > 2) u.facing = dx > 0 ? 1 : -1;
    u.moving = true;
  }

  private minionAttack(u: Unit, t: Unit) {
    if (u.range > 100) {
      if (u.kind === 'phishing') {
        const E = BALANCE.enemyUnits.phishing;
        this.fireProjectile(u, t, u.damage, 'phish', (hit) => {
          hit.slowUntil = this.simTime + E.slowTime;
          hit.slowMult = 1 - E.slow;
        });
      } else {
        const type = u.captain ? `cap_${teamOf(u.kind)}` : u.kind === 'dev' ? 'laser' : u.kind === 'pushR' ? 'spear' : u.kind === 'devC' ? 'blueorb' : 'cannon';
        this.fireProjectile(u, t, u.damage, type);
      }
    } else {
      this.dealDamage(t, u.damage, u);
      if (this.onScreen(t.x, t.y)) this.hitSpark(t.x + (Math.random() - 0.5) * 10, t.y - 18, u.side === 'ally' ? 0xbfe0ff : 0xff6b8a, 0.5);
    }
  }

  private ransomLock(u: Unit, radius: number, time: number) {
    const ring = this.add.image(u.x, u.y, 'fx_ring').setTint(0xff2e4d).setDepth(2).setDisplaySize(40, 26).setAlpha(0.9);
    this.tweens.add({ targets: ring, displayWidth: radius * 2, displayHeight: radius * 1.3, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    if (this.onScreen(u.x, u.y)) audio.play('lock');
    for (const o of this.units) {
      if (!o.alive || o.side !== 'ally' || o.isStructure) continue;
      if (u.dist(o) > radius) continue;
      o.rootUntil = this.simTime + time;
      const icon = this.add.image(o.x, o.y - 70, 'fx_lock').setScale(0.6).setDepth(5000);
      this.tweens.add({ targets: icon, y: o.y - 80, alpha: 0, delay: time * 1000 - 300, duration: 300, onComplete: () => icon.destroy() });
      if (o === this.player) this.floatText(o.x, o.y - 130, '랜섬웨어 속박!', '#ff8fa3', 16);
    }
  }

  /* ─────────── 구조물 ─────────── */
  private updateStructure(u: Unit, dt: number) {
    if (u.damage <= 0) return;
    if (u.kind === 'firewall' && u.invulnerable) return;
    u.atkTimer -= dt;
    u.scanTimer -= dt;
    if (u.scanTimer <= 0 || (u.target && !u.target.alive)) {
      u.scanTimer = 0.25;
      u.target = this.turretTarget(u);
    }
    const t = u.target;
    if (!t) return;
    if (!t.alive || u.dist(t) - t.radius > u.range) {
      u.target = null;
      return;
    }
    if (u.atkTimer <= 0) {
      u.atkTimer = u.interval;
      let dmg = u.damage;
      if (u.kind === 'turret' && t.kind !== 'player') dmg = BALANCE.structures.enemyTurret.minionDamage;
      if (u.kind === 'allyTurret' || u.kind === 'allyNexus') {
        if (t.kind === 'boss') dmg *= 0.2;
      }
      this.fireProjectile(u, t, dmg, u.side === 'ally' ? 'allyTurret' : 'turret');
      if (this.onScreen(u.x, u.y)) audio.play('turretShot');
    }
  }

  /** 포탑: 미니언 우선, 미니언이 없으면 챔피언 공격 */
  private turretTarget(u: Unit): Unit | null {
    let best: Unit | null = null,
      bd = Infinity,
      champ: Unit | null = null;
    for (const o of this.units) {
      if (!o.alive || o.side === u.side || o.isStructure) continue;
      const d = u.dist(o) - o.radius;
      if (d > u.range) continue;
      if (o.kind === 'player' || o.kind === 'boss' || o.captain) {
        if (!(o.kind === 'player' && this.dead) && (!champ || champ.captain)) champ = o;
        continue;
      }
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    // 이미 플레이어를 노리고 있다면 유지
    if (u.target && u.target === champ && u.target.alive) return champ;
    return best || champ;
  }

  private drawAimLines() {
    const g = this.aimGfx;
    g.clear();
    for (const u of this.units) {
      if (!u.alive || !u.isStructure || u.side !== 'enemy' || u.target !== this.player || this.dead) continue;
      const pulse = 0.5 + Math.sin(this.simTime * 14) * 0.3;
      g.lineStyle(4, 0xff2e4d, pulse);
      g.lineBetween(u.x, u.y - u.radius * 2, this.player.x, this.player.y - 40);
    }
  }

  /* ─────────── 보스 ZERO DAY ─────────── */
  private startBoss() {
    if (this.boss || this.bossDefeated) return;
    fsm.set(GameState.BOSS_BATTLE);
    save.update((d) => (d.stage = 'boss'));
    // 라인의 적 미니언 정리 (보스전 집중)
    const b = this.makeUnit('boss', 'enemy', BOSS_SPAWN.x, BOSS_SPAWN.y, BALANCE.boss.hp);
    b.speed = BALANCE.boss.speed;
    b.radius = 42;
    b.view.setAlpha(0);
    this.boss = b;
    this.bossState = { timer: 2.2, idx: 0, support: false, ultUsed: false, melee: 0, floorHintAt: 0 };

    this.cinematic = true;
    this.path = [];
    audio.music('boss');
    audio.play('bossAppear');
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(b.x, b.y - 60, 700, 'Sine.easeInOut');
    this.time.delayedCall(600, () => {
      bus.emit('boss:intro');
      for (let i = 0; i < 6; i++)
        this.time.delayedCall(i * 110, () => {
          b.view.setAlpha(i % 2 ? 0.3 : 1);
          b.view.x = b.x + (Math.random() - 0.5) * 20;
          this.glitchBurst(b.x, b.y - 80, 8);
        });
      this.time.delayedCall(700, () => {
        b.view.setAlpha(1);
        b.view.x = b.x;
        this.cameras.main.shake(500, 0.01);
        this.shockwave(b.x, b.y, 0xff2fd0, 300, 700);
      });
    });
    this.time.delayedCall(2900, () => {
      cam.pan(this.player.x, this.player.y, 600, 'Sine.easeInOut', false, (_c: any, prog: number) => {
        if (prog >= 1) {
          cam.startFollow(this.player.view, true, 0.12, 0.12);
          this.cinematic = false;
          bus.emit('boss:start');
          bus.emit('toast', '붉은 경고 표시가 뜨면 그 자리를 피하세요!');
        }
      });
    });
  }

  private updateBoss(b: Unit, dt: number) {
    const B = BALANCE.boss;
    const bs = this.bossState;
    const p = this.player;
    const engaged = !this.dead && Math.hypot(p.x - ENEMY_BASE.x, p.y - ENEMY_BASE.y) < BASE_RADIUS + 220;
    b.moving = false;
    if (!engaged) {
      if (b.dist(BOSS_SPAWN) > 10) this.moveToward(b, BOSS_SPAWN.x, BOSS_SPAWN.y, dt);
      return;
    }
    const d = b.dist(p);
    if (d > 230 && b.rootUntil < this.simTime) this.moveToward(b, p.x, p.y, dt);
    b.facing = p.x >= b.x ? 1 : -1;
    // 본진 밖으로 나가지 않도록
    const bd = Math.hypot(b.x - ENEMY_BASE.x, b.y - ENEMY_BASE.y);
    if (bd > BASE_RADIUS - 50) {
      const k = (BASE_RADIUS - 50) / bd;
      b.x = ENEMY_BASE.x + (b.x - ENEMY_BASE.x) * k;
      b.y = ENEMY_BASE.y + (b.y - ENEMY_BASE.y) * k;
    }
    // 근접 베기
    bs.melee -= dt;
    if (d < 110 && bs.melee <= 0) {
      bs.melee = 1.2;
      b.attackAnim = 0.25;
      this.dealDamage(p, B.meleeDamage, b);
      this.hitSpark(p.x, p.y - 30, 0xff2fd0);
    }
    // 패턴
    bs.timer -= dt;
    if (bs.timer <= 0) {
      const patterns = ['shot', 'aoe', 'shot', 'summon', 'aoe'];
      const pat = patterns[bs.idx++ % patterns.length];
      bs.timer = B.patternGap + (pat === 'aoe' ? B.aoeWarn * 0.5 : 0);
      if (pat === 'shot') this.bossShots(b);
      else if (pat === 'aoe') this.bossAoe(b);
      else this.bossSummon(b);
    }
    // 아군 지원 이벤트
    if (!bs.support && b.hp <= b.maxHp * B.supportAt) this.triggerSupport();
    if (bs.support && !bs.ultUsed && b.hp <= b.maxHp * B.floorBeforeUlt + 1 && this.simTime > bs.floorHintAt) {
      bs.floorHintAt = this.simTime + 6;
      if (this.cd.r > 0) this.cd.r = 0;
      bus.emit('hint:ult');
      bus.emit('toast', 'ZERO DAY의 방어막! 궁극기 [전 부서 집결]로 마무리하세요!');
    }
  }

  private bossShots(b: Unit) {
    const B = BALANCE.boss;
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 260, () => {
        if (!b.alive || this.dead) return;
        b.attackAnim = 0.2;
        if (i === 0) this.bossPose(b, 'boss_idle', 0.8);
        audio.play('bossShot');
        const sx = b.x + b.facing * 40,
          sy = b.y - 90;
        const ang = Math.atan2(this.player.y - 30 - sy, this.player.x - sx);
        const img = this.add.image(sx, sy, 'fx_glow').setTint(0xff2fd0).setScale(0.45).setBlendMode('ADD').setDepth(4500);
        const core = this.add.image(sx, sy, 'fx_disc').setTint(0x2a0a3d).setScale(0.13).setDepth(4501);
        this.projectiles.push({
          img: core, glow: img, x: sx, y: sy, target: null, dirX: Math.cos(ang), dirY: Math.sin(ang), speed: B.shotSpeed,
          damage: B.shotDamage, source: b, side: 'enemy', travelled: 0, maxDist: 750, radius: 26, spin: 0,
        });
      });
    }
  }

  private bossAoe(b: Unit) {
    const B = BALANCE.boss;
    const p = this.player;
    const spots: Pt[] = [{ x: p.x, y: p.y }];
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2,
        r = 140 + Math.random() * 80;
      spots.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
    }
    audio.play('warn');
    b.attackAnim = 0.3;
    this.bossPose(b, 'boss_slash', 0.7);
    for (const s of spots) {
      const rad = B.aoeRadius;
      const ring = this.add.image(s.x, s.y, 'fx_ring').setTint(0xff2e4d).setDepth(2).setDisplaySize(rad * 2, rad * 2 * 0.62);
      const fill = this.add.image(s.x, s.y, 'fx_disc').setTint(0xff2e4d).setAlpha(0.35).setDepth(2).setDisplaySize(10, 6);
      const mark = this.textures.exists('fx_warning')
        ? this.add.image(s.x, s.y - 10, 'fx_warning').setScale(56 / 90).setDepth(3)
        : this.add.text(s.x, s.y, '!', { fontFamily: 'sans-serif', fontSize: '34px', color: '#ffdddd', fontStyle: 'bold', stroke: '#5a0010', strokeThickness: 6 }).setOrigin(0.5).setDepth(3);
      this.tweens.add({ targets: ring, alpha: 0.4, yoyo: true, repeat: -1, duration: 160 });
      this.tweens.add({
        targets: fill, displayWidth: rad * 2, displayHeight: rad * 2 * 0.62, duration: B.aoeWarn * 1000, ease: 'Linear',
        onComplete: () => {
          ring.destroy();
          fill.destroy();
          mark.destroy();
          if (!this.scene.isActive()) return;
          audio.play('bossAoe');
          this.shockwave(s.x, s.y, 0xff2fd0, rad, 400);
          this.strikeFx(s.x, s.y, rad);
          this.cameras.main.shake(150, 0.005);
          for (const u of this.units) {
            if (!u.alive || u.side !== 'ally' || u.isStructure) continue;
            if (u.kind === 'player' && this.dead) continue;
            const dx = (u.x - s.x) / rad,
              dy = (u.y - s.y) / (rad * 0.62);
            if (dx * dx + dy * dy <= 1.1) this.dealDamage(u, B.aoeDamage, b);
          }
        },
      });
    }
  }

  private bossSummon(b: Unit) {
    const B = BALANCE.boss;
    b.attackAnim = 0.3;
    this.glitchBurst(b.x, b.y - 60, 12);
    this.bossPose(b, 'boss_punch', 0.6);
    const n = this.units.filter((u) => u.alive && u.kind === 'bug' && !u.lane).length;
    for (let i = 0; i < B.summonCount && n + i < 8; i++) {
      const a = (i / B.summonCount) * Math.PI * 2 + Math.random();
      const x = b.x + Math.cos(a) * 80,
        y = b.y + Math.sin(a) * 60;
      const u = this.makeUnit('bug', 'enemy', x, y, 1);
      this.applyStats(u, BALANCE.enemyUnits.bug, 0.8);
      u.refreshHp();
      this.playFrames(x, y + 6, ['fx_portal'], { height: 80, hold: 350, depth: y - 1, originY: 0.85 });
      u.view.setAlpha(0);
      this.tweens.add({ targets: u.view, alpha: 1, duration: 400 });
    }
    bus.emit('toast', 'ZERO DAY가 취약점 버그를 소환했습니다!');
  }

  private triggerSupport() {
    const bs = this.bossState;
    bs.support = true;
    this.cd.r = 0;
    bus.emit('banner', { text: '아군 지원 도착!', sub: '추진팀 · 개발팀 · 사업팀 합류', kind: 'support' });
    audio.play('summon');
    const teams: TeamId[] = ['push', 'dev', 'biz'];
    let k = 0;
    for (const t of teams) for (let i = 0; i < 2; i++) this.spawnRally(t, (k++ / 6) * Math.PI * 2, 9999);
    const greet = ['부장님, 저희가 왔습니다!', '패치 배포 준비 완료!', '마지막 계약, 함께 성사시키죠!'];
    const rallies = this.units.filter((u) => u.rally);
    teams.forEach((t, i) => {
      const r = rallies.find((u) => u.kind === t);
      if (r) this.time.delayedCall(300 + i * 500, () => this.bubble(r, greet[i], 2.4));
    });
    this.time.delayedCall(1200, () => bus.emit('hint:ult'));
  }

  private bossDied(b: Unit) {
    this.bossDefeated = true;
    this.boss = null;
    audio.play('turretDestroy');
    this.cameras.main.shake(700, 0.015);
    for (let i = 0; i < 5; i++) this.time.delayedCall(i * 140, () => this.glitchBurst(b.x + (Math.random() - 0.5) * 80, b.y - 40 - Math.random() * 100, 14));
    this.shockwave(b.x, b.y, 0xff2fd0, 360, 900);
    this.blastFx(b.x, b.y, 340);
    this.tweens.add({ targets: b.view, alpha: 0, scaleX: 1.6, scaleY: 0.2, duration: 900, onComplete: () => b.destroyView() });
    bus.emit('banner', { text: 'ZERO DAY 무력화!', sub: '넥서스 방어시설을 제거하세요', kind: 'boss' });
    bus.emit('boss:end');
    // 소환 버그 정리, 지원 미니언은 잠시 더 함께
    for (const u of this.units) {
      if (u.alive && u.kind === 'bug' && !u.lane) this.killUnit(u, null);
      if (u.alive && u.rally) u.expireAt = this.simTime + 30;
    }
    this.startNexusPhase();
  }

  private startNexusPhase() {
    fsm.set(GameState.NEXUS_BATTLE);
    audio.music('field');
    save.update((d) => (d.stage = 'nexus'));
    this.saveProgress();
    for (const [id, s] of this.structures) {
      if (id.startsWith('fw_') && s.alive) {
        s.invulnerable = false;
        this.addRangeRing(s, 0xff6a2b);
      }
    }
    this.checkNexusShield();
  }

  private checkNexusShield() {
    const nx = this.structures.get('nexus')!;
    const fwAlive = [...this.structures.entries()].some(([id, s]) => id.startsWith('fw_') && s.alive);
    if (!fwAlive && this.bossDefeated && nx.invulnerable) {
      nx.invulnerable = false;
      this.removeShield('nexus');
      bus.emit('banner', { text: '넥서스 방어막 해제!', sub: '최후의 일격을 날리세요', kind: 'info' });
    }
  }

  /* ─────────── 전투 공통 ─────────── */
  private fireProjectile(src: Unit, target: Unit, damage: number, type: string, onHit?: (t: Unit) => void) {
    const sx = src.x + src.facing * (src.isStructure ? 0 : 16);
    const sy = src.y - (src.isStructure ? src.displayH * 0.75 : src.kind === 'player' ? 74 : 30);
    let img: Phaser.GameObjects.Image;
    let glow: Phaser.GameObjects.Image | undefined;
    let speed = 520,
      spin = 0;
    if (type === 'player') {
      glow = this.add.image(sx, sy, 'fx_glow').setTint(0x00b7ff).setScale(0.38).setBlendMode('ADD');
      img = this.add.image(sx, sy, 'fx_spark').setTint(0xe6fbff).setScale(0.8);
      speed = 720;
      spin = 10;
    } else if (type === 'turret' && src.kind === 'turret') {
      // 포탑 대포: 분홍 에너지탄
      img = this.add.image(sx, sy, 'fx_disc').setTint(0xffd6f0).setScale(0.12);
      glow = this.add.image(sx, sy, 'fx_glow').setTint(0xff3bd4).setScale(0.45).setBlendMode('ADD');
      speed = 500;
    } else if (type === 'turret') {
      // 방화벽(복합기): 용지 발사
      img = this.add.image(sx, sy, 'fx_paper').setScale(0.9);
      glow = this.add.image(sx, sy, 'fx_glow').setTint(0xff3bd4).setScale(0.32).setBlendMode('ADD');
      speed = 480;
      spin = 8;
    } else if (type.startsWith('cap_') && this.textures.exists(`fx_${type}_bolt`)) {
      // 팀장 에너지탄 (팀장 스프라이트 시트의 투사체)
      img = this.add.image(sx, sy, `fx_${type}_bolt`).setScale(0.6).setBlendMode('ADD');
      speed = 640;
    } else if (type === 'spear') {
      img = this.add.image(sx, sy, 'fx_bolt').setTint(0x7fb3ff).setScale(0.8, 0.5);
      speed = 700;
    } else if (type === 'blueorb') {
      img = this.add.image(sx, sy, 'fx_disc').setTint(0xe6fbff).setScale(0.1);
      glow = this.add.image(sx, sy, 'fx_glow').setTint(0x00b7ff).setScale(0.4).setBlendMode('ADD');
      speed = 520;
    } else if (type === 'allyTurret') {
      img = this.add.image(sx, sy, 'fx_bolt').setTint(0x9fdcff);
      glow = this.add.image(sx, sy, 'fx_glow').setTint(0x00b7ff).setScale(0.3).setBlendMode('ADD');
      speed = 640;
    } else if (type === 'laser') {
      img = this.add.image(sx, sy, 'fx_bolt').setTint(0x00e5ff).setScale(0.7, 0.6);
      speed = 760;
    } else if (type === 'cannon') {
      img = this.add.image(sx, sy, 'fx_paper').setScale(0.7).setTint(0xdfffee);
      glow = this.add.image(sx, sy, 'fx_glow').setTint(0x00dc84).setScale(0.28).setBlendMode('ADD');
      speed = 430;
      spin = 12;
    } else {
      img = this.add.image(sx, sy, 'fx_glow').setTint(0xb06bff).setScale(0.26).setBlendMode('ADD');
      speed = 460;
    }
    img.setDepth(4500);
    glow?.setDepth(4499);
    this.projectiles.push({
      img, glow, x: sx, y: sy, target, dirX: 0, dirY: 0, speed, damage, source: src, side: src.side, travelled: 0,
      maxDist: 2000, radius: 0, spin, onHit,
    });
  }

  private updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      if (pr.target) {
        const t = pr.target;
        if (!t.alive) {
          pr.dead = true;
          continue;
        }
        const tx = t.x,
          ty = t.y - (t.isStructure ? t.radius * 0.9 : 26);
        const dx = tx - pr.x,
          dy = ty - pr.y;
        const d = Math.hypot(dx, dy);
        const step = pr.speed * dt;
        if (d <= step + 6) {
          pr.dead = true;
          this.dealDamage(t, pr.damage, pr.source);
          pr.onHit?.(t);
          if (this.onScreen(tx, ty)) this.hitSpark(tx, ty, pr.side === 'ally' ? 0x9fdcff : 0xd9b3ff, 0.55);
          continue;
        }
        pr.x += (dx / d) * step;
        pr.y += (dy / d) * step;
        pr.img.rotation = pr.spin ? pr.img.rotation + pr.spin * dt : Math.atan2(dy, dx);
      } else {
        // 직선 투사체(보스): 회피 가능
        const step = pr.speed * dt;
        pr.x += pr.dirX * step;
        pr.y += pr.dirY * step;
        pr.travelled += step;
        if (pr.travelled > pr.maxDist || !this.grid.walkable(pr) && pr.travelled > 200) {
          pr.dead = true;
          continue;
        }
        for (const u of this.units) {
          if (!u.alive || u.side === pr.side || u.isStructure) continue;
          if (u.kind === 'player' && this.dead) continue;
          if (Math.hypot(u.x - pr.x, u.y - 30 - pr.y) < pr.radius + u.radius) {
            pr.dead = true;
            this.dealDamage(u, pr.damage, pr.source);
            this.hitSpark(pr.x, pr.y, 0xff2fd0);
            break;
          }
        }
      }
      pr.img.setPosition(pr.x, pr.y);
      pr.glow?.setPosition(pr.x, pr.y);
    }
    if (this.projectiles.some((p) => p.dead)) {
      for (const p of this.projectiles)
        if (p.dead) {
          p.img.destroy();
          p.glow?.destroy();
        }
      this.projectiles = this.projectiles.filter((p) => !p.dead);
    }
  }

  dealDamage(t: Unit, amount: number, src: Unit | null) {
    if (!t.alive || t.invulnerable) return;
    if (t.kind === 'player' && this.dead) return;
    let dmg = amount * t.armor;
    if (t.buffDef) dmg *= BALANCE.captains.pushDamageTaken;
    if (t.isStructure && src?.buffTower) dmg *= BALANCE.captains.bizStructureDamage;
    if (t.shieldUntil > this.simTime) dmg *= 1 - BALANCE.skills.w.damageReduction;
    dmg = Math.max(1, Math.round(dmg));
    let hp = t.hp - dmg;
    if (t.kind === 'boss' && !this.bossState.ultUsed) hp = Math.max(t.maxHp * BALANCE.boss.floorBeforeUlt, hp);
    // 넥서스의 마지막 일격은 반드시 플레이어가
    if (t.kind === 'nexus' && src !== this.player) hp = Math.max(1, hp);
    const real = t.hp - hp;
    t.hp = hp;
    t.lastHitAt = this.simTime;
    t.hitFlash = 0.09;
    t.refreshHp();
    if (src === this.player && real > 0) {
      bus.emit('tut:attacked');
      this.floatText(t.x + (Math.random() - 0.5) * 20, t.y - (t.isStructure ? t.radius * 2.2 : 60), String(Math.round(real)), '#ffe9a8', 15);
    } else if (t === this.player) {
      this.floatText(t.x + (Math.random() - 0.5) * 20, t.y - 90, '-' + dmg, '#ffa3b0', 14);
      if (dmg >= 60) this.cameras.main.shake(90, 0.004);
      bus.emit('player:hit');
    }
    if (t.hp <= 0) this.killUnit(t, src);
  }

  private killUnit(u: Unit, src: Unit | null) {
    if (!u.alive) return;
    if (u === this.player) {
      this.playerDied();
      return;
    }
    if (u.captain) return this.captainDown(u);
    u.alive = false;
    if (u.kind === 'boss') return this.bossDied(u);
    if (u.isStructure) return this.structureDestroyed(u);

    const X = BALANCE.xp;
    if (u.side === 'enemy' && !this.dead && this.player.dist(u) < X.shareRange) {
      this.gainXp(u.kind === 'ransomware' ? X.ransomware : X.minion);
    }
    if (!this.onScreen(u.x, u.y)) {
      u.destroyView();
      return;
    }
    if (u.side === 'ally') {
      // 과격한 연출 대신 빛과 함께 본진 귀환
      const ret = `m_${u.kind}_ret`;
      if (this.textures.exists(ret)) {
        u.view.setVisible(false);
        this.playFrames(u.x, u.y + 6, [ret], { height: 70, hold: 350, depth: u.y, originY: 0.95 });
        u.destroyView();
      } else {
        this.lightPillar(u.x, u.y, 0x9fdcff);
        this.tweens.add({ targets: u.view, alpha: 0, y: u.y - 40, duration: 500, onComplete: () => u.destroyView() });
      }
    } else {
      this.glitchBurst(u.x, u.y - 16, 8);
      this.tweens.add({ targets: u.view, alpha: 0, scaleX: 1.4, scaleY: 0.3, duration: 260, onComplete: () => u.destroyView() });
    }
  }

  private structureDestroyed(u: Unit) {
    const id = u.structId;
    this.grid.setCircleBlocked(u, u.kind === 'nexus' ? 70 : u.kind === 'turret' ? 44 : u.kind === 'inhibitor' ? 34 : 26, false);
    for (const e of u.extra) e.destroy();
    u.extra = [];
    if (u.kind === 'nexus') {
      u.hpBg?.setVisible(false);
      u.hpFill?.setVisible(false);
      return this.victorySequence(u);
    }
    // 폐허 표시
    u.hpBg?.setVisible(false);
    u.hpFill?.setVisible(false);
    this.showRuin(u);
    this.blastFx(u.x, u.y, u.displayH * 1.5);
    this.shockwave(u.x, u.y, 0xffe28a, 220, 700);
    for (let i = 0; i < 18; i++) this.debris(u.x, u.y - u.radius);
    this.cameras.main.shake(450, 0.012);
    audio.play('turretDestroy');
    if (!this.dead) this.gainXp(u.kind === 'turret' ? BALANCE.xp.turret : BALANCE.xp.inhibitor);

    const laneId = id.split('_')[0];
    const lane = this.lanesMgr.lanes.find((l) => l.def.id === laneId);
    if (u.kind === 'turret' && lane) {
      lane.turretAlive = false;
      const inh = this.structures.get(`${laneId}_inhib`);
      if (inh && inh.alive) {
        inh.invulnerable = false;
        this.removeShield(inh.structId);
      }
      bus.emit('banner', { text: '포탑 파괴!', sub: `다음 목표: ${lane.def.label} 억제기`, kind: 'turret' });
      if (!this.firstTurretDone) {
        this.firstTurretDone = true;
        this.time.delayedCall(1500, () => this.discoverMemory(MEMORY_TURRET_ID, '파괴된 포탑 속 기록'));
      }
    } else if (u.kind === 'inhibitor' && lane) {
      lane.inhibAlive = false;
      lane.gateOpen = true;
      this.openGate(laneId);
      bus.emit('banner', { text: '억제기 파괴!', sub: '적 본진 진입 가능', kind: 'turret' });
      this.peekEnemyBase();
    } else if (u.kind === 'firewall') {
      bus.emit('banner', { text: '방화벽 제거!', kind: 'info' });
      this.checkNexusShield();
    }
    this.saveProgress();
  }

  /** 파괴된 구조물을 폐허 이미지로 교체 */
  private showRuin(u: Unit) {
    const ruin = RUIN[u.kind];
    if (ruin && this.textures.exists(ruin)) {
      u.normFrames = true;
      u.displayH = u.displayH * 0.75;
      u.setTex(ruin);
      u.sprite.setScale(u.baseScale).clearTint().setAlpha(1);
    } else {
      u.sprite.setAlpha(0.35).setTint(0x555566).setScale(u.baseScale, u.baseScale * 0.55);
    }
    u.view.setVisible(this.onScreen(u.x, u.y, 160));
    u.view.setPosition(u.x, u.y).setDepth(u.y);
  }

  private peekEnemyBase() {
    const cam = this.cameras.main;
    this.cinematic = true;
    cam.stopFollow();
    cam.pan(ENEMY_BASE.x, ENEMY_BASE.y + 40, 900, 'Sine.easeInOut');
    this.time.delayedCall(1900, () => {
      cam.pan(this.player.x, this.player.y, 700, 'Sine.easeInOut', false, (_c: any, prog: number) => {
        if (prog >= 1) {
          cam.startFollow(this.player.view, true, 0.12, 0.12);
          this.cinematic = false;
        }
      });
    });
  }

  /* ─────────── 진행 ─────────── */
  private checkProgressTriggers() {
    const p = this.player;
    if (this.dead) return;
    // 적 본진 진입 → 보스전
    if (!this.boss && !this.bossDefeated && Math.hypot(p.x - ENEMY_BASE.x, p.y - ENEMY_BASE.y) < BASE_RADIUS + 10) {
      this.startBoss();
    }
    // 라인 인사 말풍선
    for (const lane of this.lanesMgr.lanes) {
      const cap = this.captains[lane.def.team];
      if (cap && cap.alive && !this.greetedCaptains.has(lane.def.team) && cap.dist(p) < 280) {
        this.greetedCaptains.add(lane.def.team);
        lane.greeted = true;
        this.bubble(cap, CAPTAIN_DEFS[lane.def.team].greeting, 2.8);
        continue;
      }
      if (lane.greeted || !lane.active) continue;
      const near = this.units.find((u) => u.alive && u.lane === lane && u.side === 'ally' && u.dist(p) < 260);
      if (near) {
        lane.greeted = true;
        this.bubble(near, lane.def.greeting, 3);
      }
    }
  }

  private checkMemories() {
    if (this.dead) return;
    for (const m of this.memories) {
      if (m.taken) continue;
      if (Math.hypot(this.player.x - m.pos.x, this.player.y - m.pos.y) < 75) {
        m.taken = true;
        for (const o of m.objs) this.tweens.killTweensOf(o);
        this.tweens.add({ targets: m.objs, alpha: 0.3, duration: 400 });
        this.lightPillar(m.pos.x, m.pos.y, 0xffe28a);
        this.discoverMemory(m.id, m.label);
      }
    }
  }

  private discoverMemory(id: string, label: string) {
    const isNew = save.unlock(id);
    if (!isNew) return;
    audio.play('memory');
    bus.emit('memory:found', { id, label });
  }

  private saveProgress() {
    const destroyed = [...this.structures.entries()].filter(([, s]) => !s.alive).map(([id]) => id);
    save.update((d) => {
      d.progress = { destroyed, level: this.level, xp: this.xp, bossDefeated: this.bossDefeated };
    });
  }

  private restoreProgress(prog: NonNullable<typeof save.data.progress>) {
    // 레벨
    const P = BALANCE.player;
    this.level = 1;
    this.xp = prog.xp;
    while (this.level < prog.level) {
      this.level++;
      this.player.maxHp += P.hpPerLevel;
      this.player.damage += P.attackPerLevel;
    }
    this.player.hp = this.player.maxHp;
    // 구조물
    for (const id of prog.destroyed) {
      const s = this.structures.get(id);
      if (!s || !s.alive) continue;
      s.alive = false;
      s.hp = 0;
      this.grid.setCircleBlocked(s, s.kind === 'turret' ? 44 : s.kind === 'inhibitor' ? 34 : 26, false);
      for (const e of s.extra) e.destroy();
      s.extra = [];
      s.hpBg?.setVisible(false);
      s.hpFill?.setVisible(false);
      this.showRuin(s);
      const [laneId, type] = id.split('_');
      const lane = this.lanesMgr.lanes.find((l) => l.def.id === laneId);
      if (lane && type === 'turret') {
        lane.turretAlive = false;
        this.firstTurretDone = true;
        const inh = this.structures.get(`${laneId}_inhib`);
        if (inh) {
          inh.invulnerable = false;
          this.shields.get(inh.structId)?.destroy();
          this.shields.delete(inh.structId);
        }
      }
      if (lane && type === 'inhib') {
        lane.inhibAlive = false;
        lane.gateOpen = true;
        this.openGate(laneId, true);
      }
    }
    if (prog.bossDefeated) {
      this.bossDefeated = true;
      this.resumeNexus = true;
    }
  }

  /* ─────────── 승리 ─────────── */
  private victorySequence(nx: Unit) {
    this.cinematic = true;
    fsm.set(GameState.VICTORY);
    const cam = this.cameras.main;
    cam.stopFollow();
    this.player.setTex('champ_victory');
    this.castAnim = 99;
    audio.music('none');
    audio.play('turretDestroy');
    cam.pan(nx.x, nx.y - 80, 600, 'Sine.easeOut');
    cam.zoomTo(cam.zoom * 1.35, 900, 'Sine.easeOut');
    // 부장님의 최후의 일격
    this.beam(this.player.x, this.player.y - 70, nx.x, nx.y - 110, 0xffe28a);
    this.floatText(this.player.x, this.player.y - 140, '최후의 일격!', '#ffe28a', 22);
    for (let i = 0; i < 4; i++)
      this.time.delayedCall(250 + i * 260, () => {
        this.shockwave(nx.x, nx.y - 80, i % 2 ? 0xffffff : 0xb06bff, 300 + i * 160, 900);
        cam.shake(260, 0.02);
        for (let k = 0; k < 10; k++) this.debris(nx.x, nx.y - 100);
      });
    this.tweens.add({ targets: nx.sprite, alpha: 0, scaleX: nx.baseScale * 1.4, scaleY: nx.baseScale * 1.4, delay: 900, duration: 700 });
    this.time.delayedCall(1100, () => {
      cam.flash(500, 255, 255, 255);
      audio.play('victory');
    });
    this.time.delayedCall(2100, () => cam.fadeOut(700, 0, 0, 0));
    this.time.delayedCall(2900, () => {
      save.update((d) => {
        d.cleared = true;
        d.stage = 'cleared';
        d.progress = null;
      });
      save.unlock(MEMORY_VICTORY_ID);
      audio.music('victory');
      audio.voice('voice_victory');
      bus.emit('victory');
    });
  }

  /* ════════════════════════ 화면 갱신 ════════════════════════ */
  private onScreen(x: number, y: number, margin = 120) {
    const v = this.cameras.main.worldView;
    return x > v.x - margin && x < v.right + margin && y > v.y - margin && y < v.bottom + margin;
  }

  private updateViews() {
    const t = this.simTime;
    const dt = Math.min(this.game.loop.delta, 50) / 1000;
    for (const u of this.units) {
      if (!u.alive && !u.isStructure) continue;
      const vis = this.onScreen(u.x, u.y, 160);
      u.view.setVisible(vis && (u.alive || u.isStructure));
      if (!vis || !u.alive) continue;
      u.view.setPosition(u.x, u.y);
      u.view.setDepth(u.y);
      if (u.isStructure) {
        if (u.hitFlash > 0) {
          u.hitFlash -= dt;
          u.sprite.setTint(0xffd0d0);
          if (u.hitFlash <= 0) u.sprite.clearTint();
        }
        continue;
      }
      // 프레임 애니메이션 + 가벼운 흔들림
      const fly = u.kind === 'phishing' ? -14 + Math.sin(t * 5 + u.bobPhase) * 5 : 0;
      const a = u.anim;
      let tex = u.curTex;
      if (u.attackAnim > 0) u.attackAnim -= dt;
      if (u.hitFlash > 0) u.hitFlash -= dt;
      if (a) {
        if (u.attackAnim > 0 && a.atk) tex = a.atk;
        else if (u.hitFlash > 0 && a.hit) tex = a.hit;
        else if (u.moving) tex = a.run[Math.floor(t * 9 + u.bobPhase) % a.run.length];
        else tex = a.idle[Math.floor(t * 2.5 + u.bobPhase) % a.idle.length];
      }
      if (u === this.player) {
        if (this.castAnim > 50) tex = 'champ_victory';
        else if (this.castAnim > 0) tex = 'champ_atk_1';
        else if (u.attackAnim > 0) tex = ['champ_atk_0', 'champ_atk_1', 'champ_atk_2', 'champ_atk_3'][Math.min(3, Math.floor((1 - u.attackAnim / 0.22) * 4))];
      }
      u.setTex(tex);
      if (u.moving) {
        const ph = t * 13 + u.bobPhase;
        u.sprite.y = u.spriteBaseY - Math.abs(Math.sin(ph)) * 2 + fly;
        u.sprite.setScale(u.baseScale);
      } else {
        u.sprite.y = u.spriteBaseY + fly;
        u.sprite.setScale(u.baseScale, u.baseScale * (1 + Math.sin(t * 3.5 + u.bobPhase) * 0.02));
      }
      u.sprite.rotation = 0;
      u.sprite.x = u.attackAnim > 0 && !a?.atk ? u.facing * Math.sin((u.attackAnim / 0.22) * Math.PI) * 7 : 0;
      u.sprite.setFlipX(u.facing < 0);
      const tinted = u.hitFlash > 0;
      if (tinted !== (u as any)._tinted) {
        (u as any)._tinted = tinted;
        if (tinted) u.sprite.setTint(u === this.player ? 0xffc8c8 : 0xffc0c0);
        else if (u.side === 'enemy' && u.lane?.inhibAlive) u.sprite.setTint(0xffb3c6);
        else u.sprite.clearTint();
      }
      if (u.shieldFx) u.shieldFx.setVisible(u.shieldUntil > this.simTime);
    }
    // 대상 표시 링
    const at = this.attackTarget;
    if (at && at.alive && !this.dead) {
      this.targetRing.setPosition(at.x, at.y).setAlpha(0.85).setDisplaySize(at.radius * 2.6, at.radius * 1.6).setDepth(at.y - 1);
    } else this.targetRing.setAlpha(0);
  }

  private pushHud(force = false) {
    const p = this.player;
    const S = BALANCE.skills;
    const X = BALANCE.xp;
    const lvlBase = X.levels[this.level - 1] ?? 0;
    const lvlNext = X.levels[this.level] ?? null;
    const obj = this.objective();
    let arrow: { x: number; y: number } | null = null;
    if (obj.pos && !this.onScreen(obj.pos.x, obj.pos.y, -40)) {
      const cam = this.cameras.main;
      const dpr = (this.game.registry.get('dpr') as number) || 1;
      arrow = {
        x: ((obj.pos.x - cam.worldView.x) * cam.zoom) / dpr,
        y: ((obj.pos.y - cam.worldView.y) * cam.zoom) / dpr,
      };
    }
    bus.emit('hud', {
      force,
      hp: p.hp,
      maxHp: p.maxHp,
      level: this.level,
      xp: lvlNext === null ? 1 : (this.xp - lvlBase) / (lvlNext - lvlBase),
      cd: {
        q: [this.cd.q, S.q.cooldown],
        w: [this.cd.w, S.w.cooldown],
        r: [this.cd.r, this.cd.r > S.r.cooldown ? S.r.initialCooldown : S.r.cooldown],
      },
      shield: p.shieldUntil > this.simTime,
      buffs: this.dead ? [] : [p.buffDef && 'push', p.buffAs && 'dev', p.buffTower && 'biz'].filter(Boolean),
      rooted: p.rootUntil > this.simTime,
      objective: obj.text,
      arrow,
      boss: this.boss && this.boss.alive ? { hp: this.boss.hp, max: this.boss.maxHp, locked: this.bossState.support && !this.bossState.ultUsed && this.boss.hp <= this.boss.maxHp * BALANCE.boss.floorBeforeUlt + 1 } : null,
      respawn: this.dead ? Math.max(0, this.respawnAt - this.simTime) : null,
    });
  }

  private objective(): { text: string; pos: Pt | null } {
    const p = this.player;
    if (this.boss && this.boss.alive) return { text: 'ZERO DAY를 물리치세요', pos: this.boss };
    if (this.bossDefeated) {
      const fw = [...this.structures.values()].filter((s) => s.kind === 'firewall' && s.alive).sort((a, b) => a.dist(p) - b.dist(p))[0];
      if (fw) return { text: '넥서스 방화벽을 제거하세요', pos: fw };
      return { text: '넥서스를 파괴하세요!', pos: ENEMY_NEXUS };
    }
    const lanesOpen = this.lanesMgr.lanes.filter((l) => l.gateOpen);
    if (lanesOpen.length) return { text: '적 본진으로 진입하세요', pos: ENEMY_BASE };
    // 가장 가까운 라인의 다음 목표
    let lane = this.lanesMgr.lanes[1];
    let best = Infinity;
    if (Math.hypot(p.x - ALLY_BASE.x, p.y - ALLY_BASE.y) > BASE_RADIUS + 120) {
      for (const l of this.lanesMgr.lanes) {
        const d = Math.hypot(p.x - l.point(l.poly.project(p)).x, p.y - l.point(l.poly.project(p)).y);
        if (d < best) {
          best = d;
          lane = l;
        }
      }
    } else {
      // 본진: 이미 공략 중인 라인 우선
      const prog = this.lanesMgr.lanes.find((l) => !l.turretAlive);
      if (prog) lane = prog;
      else return { text: '원하는 라인을 골라 적 포탑을 파괴하세요', pos: null };
    }
    if (lane.turretAlive) return { text: `${lane.def.label} 라인: 적 포탑을 파괴하세요`, pos: lane.def.enemyTurret };
    return { text: `${lane.def.label} 라인: 억제기를 파괴하세요`, pos: lane.def.inhibitor };
  }

  private minimapData() {
    return {
      player: this.dead ? null : { x: this.player.x, y: this.player.y },
      units: this.units.filter((u) => u.alive && !u.isStructure && u !== this.player).map((u) => ({ x: u.x, y: u.y, side: u.side, boss: u.kind === 'boss' })),
      structures: this.units.filter((u) => u.isStructure).map((u) => ({ x: u.x, y: u.y, side: u.side, alive: u.alive, kind: u.kind })),
      memories: this.memories.filter((m) => !m.taken).map((m) => m.pos),
      captains: (['push', 'dev', 'biz'] as TeamId[]).filter((t) => this.captains[t]).map((t) => {
        const c = this.captains[t];
        const home = c.lane!.point(0);
        return c.alive ? { team: t, x: c.x, y: c.y, dead: false } : { team: t, x: home.x, y: home.y, dead: true, respawn: Math.max(0, c.respawnAt - this.simTime) };
      }),
      lanes: this.lanesMgr.lanes.map((l) => ({ id: l.def.id, front: l.point(l.front), active: l.active, team: l.def.teamName })),
    };
  }

  private onState(prev: GameState, next: GameState) {
    const overlay = [GameState.PAUSED, GameState.ARCHIVE, GameState.VIDEO];
    if (overlay.includes(next) && !overlay.includes(prev)) {
      this.pointerHeld = false;
      if (this.scene.isActive()) this.scene.pause();
    } else if (!overlay.includes(next) && overlay.includes(prev)) {
      if (this.scene.isPaused()) this.scene.resume();
    }
  }

  /* ════════════════════════ 이펙트 ════════════════════════ */
  private tapMarker(x: number, y: number, color: number) {
    const r = this.add.image(x, y, 'fx_ring').setTint(color).setDepth(2).setDisplaySize(70, 44).setAlpha(0.9);
    this.tweens.add({ targets: r, displayWidth: 16, displayHeight: 10, alpha: 0, duration: 380, onComplete: () => r.destroy() });
  }

  hitSpark(x: number, y: number, color: number, scale = 0.8) {
    const s = this.add.image(x, y, 'fx_spark').setTint(color).setScale(scale).setDepth(4600).setBlendMode('ADD');
    this.tweens.add({ targets: s, scale: scale * 1.6, alpha: 0, angle: 90, duration: 220, onComplete: () => s.destroy() });
  }

  floatText(x: number, y: number, text: string, color: string, size: number) {
    if (this.dmgTexts.length > 24) return;
    const t = gameText(this, x, y, text, 'float', { fontSize: Math.min(Math.round(size * 1.3), 26) + 'px', color, fontStyle: size >= 18 ? '700' : '600' }).setDepth(6000);
    this.dmgTexts.push(t);
    this.tweens.add({
      targets: t, y: y - 36, alpha: 0, duration: 750, ease: 'Cubic.easeOut',
      onComplete: () => {
        t.destroy();
        this.dmgTexts = this.dmgTexts.filter((d) => d !== t);
      },
    });
  }

  shockwave(x: number, y: number, color: number, radius: number, dur: number) {
    const r = this.add.image(x, y, 'fx_ring').setTint(color).setDepth(3).setDisplaySize(20, 12).setAlpha(0.95).setBlendMode('ADD');
    this.tweens.add({ targets: r, displayWidth: radius * 2, displayHeight: radius * 1.24, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  lightPillar(x: number, y: number, color: number) {
    const g = this.add.image(x, y - 60, 'fx_soft').setTint(color).setDisplaySize(50, 200).setBlendMode('ADD').setDepth(y + 2).setAlpha(0.9);
    this.tweens.add({ targets: g, displayWidth: 6, alpha: 0, duration: 700, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    for (let i = 0; i < 6; i++) {
      const s = this.add.image(x + (Math.random() - 0.5) * 40, y - Math.random() * 30, 'fx_spark').setTint(color).setScale(0.4).setBlendMode('ADD').setDepth(y + 3);
      this.tweens.add({ targets: s, y: s.y - 80 - Math.random() * 60, alpha: 0, duration: 700 + Math.random() * 300, onComplete: () => s.destroy() });
    }
  }

  summonEffect(x: number, y: number) {
    this.lightPillar(x, y, 0x00b7ff);
    this.shockwave(x, y, 0x00b7ff, 160, 700);
    this.shockwave(x, y, 0xffe28a, 110, 900);
  }

  pixelBurst(x: number, y: number, color: number) {
    const s = this.add.image(x, y, 'fx_pixel').setTint(color).setScale(1.2).setDepth(4600);
    this.tweens.add({ targets: s, x: x + (Math.random() - 0.5) * 50, y: y - 20 - Math.random() * 40, alpha: 0, duration: 450, onComplete: () => s.destroy() });
  }

  glitchBurst(x: number, y: number, n: number) {
    const cols = [0xb06bff, 0x00e5ff, 0xff3bd4, 0x6f36ff];
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 'fx_pixel').setTint(cols[i % 4]).setScale(0.8 + Math.random() * 1.6, 0.6 + Math.random()).setDepth(4600);
      this.tweens.add({ targets: s, x: x + (Math.random() - 0.5) * 90, y: y + (Math.random() - 0.5) * 70, alpha: 0, duration: 300 + Math.random() * 300, onComplete: () => s.destroy() });
    }
  }

  debris(x: number, y: number) {
    const s = this.add.image(x, y, 'fx_pixel').setTint(Math.random() < 0.5 ? 0x8d93a3 : 0xb06bff).setScale(1 + Math.random() * 2).setDepth(4600);
    const a = Math.random() * Math.PI * 2,
      r = 60 + Math.random() * 120;
    this.tweens.add({ targets: s, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.6 + 40, angle: 360, alpha: 0, duration: 700 + Math.random() * 400, ease: 'Cubic.easeOut', onComplete: () => s.destroy() });
  }

  beam(x1: number, y1: number, x2: number, y2: number, color: number) {
    const g = this.add.graphics().setDepth(5500).setBlendMode('ADD');
    g.lineStyle(16, color, 0.35);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(6, color, 0.9);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(2, 0xffffff, 1);
    g.lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: g, alpha: 0, duration: 550, onComplete: () => g.destroy() });
    this.hitSpark(x2, y2, color, 1.4);
  }

  /** 텍스처 프레임을 순서대로 재생하는 1회성 이펙트 */
  playFrames(x: number, y: number, keys: string[], opts: { height: number; frameMs?: number; depth?: number; hold?: number; add?: boolean; flip?: boolean; originY?: number } ) {
    const ks = keys.filter((k) => this.textures.exists(k));
    if (!ks.length) return null;
    const img = this.add.image(x, y, ks[0]).setOrigin(0.5, opts.originY ?? 0.5).setDepth(opts.depth ?? 4600).setFlipX(!!opts.flip);
    if (opts.add) img.setBlendMode('ADD');
    const fit = () => img.setScale(opts.height / img.height);
    fit();
    const ms = opts.frameMs ?? 90;
    ks.slice(1).forEach((k, i) => this.time.delayedCall(ms * (i + 1), () => { if (img.active) { img.setTexture(k); fit(); } }));
    this.tweens.add({ targets: img, alpha: 0, delay: ms * ks.length + (opts.hold ?? 0), duration: 260, onComplete: () => img.destroy() });
    return img;
  }

  /** 보스 광역 공격 착탄: 붉은 번개 */
  strikeFx(x: number, y: number, rad: number) {
    const img = this.playFrames(x, y + rad * 0.35, ['fx_red_strike'], { height: rad * 2.6, hold: 120, depth: y + 2, originY: 1, add: false });
    if (img) {
      img.setScale(img.scale * 0.6);
      this.tweens.add({ targets: img, scale: img.scale / 0.6, duration: 140, ease: 'Back.easeOut' });
    } else this.glitchBurst(x, y - 20, 8);
  }

  /** 적 구조물·보스 파괴: 보랏빛 충격파 */
  blastFx(x: number, y: number, h: number) {
    const img = this.playFrames(x, y + h * 0.3, ['fx_purple_blast'], { height: h, hold: 350, depth: y + 50, originY: 1 });
    if (img) {
      img.setScale(img.scale * 0.5);
      this.tweens.add({ targets: img, scale: img.scale * 2, duration: 260, ease: 'Back.easeOut' });
    }
  }

  /** 보스 공격 자세 일시 표시 */
  private bossPose(b: Unit, key: string, secs: number) {
    b.anim = { idle: [key], run: [key] };
    this.time.delayedCall(secs * 1000, () => {
      if (b.alive) b.anim = KIND_VIEW.boss.anim!;
    });
  }

  coneFx(x: number, y: number, ang: number, range: number, deg: number) {
    const g = this.add.graphics().setDepth(3).setBlendMode('ADD');
    const half = Phaser.Math.DegToRad(deg / 2);
    g.fillStyle(0x00b7ff, 0.22);
    g.slice(x, y + 20, range, ang - half, ang + half, false);
    g.fillPath();
    this.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
    // 긴급 대응: 푸른 참격파 3줄기
    const flip = Math.cos(ang) < 0;
    for (let i = -1; i <= 1; i++) {
      const a = ang + i * half * 0.6;
      const img = this.add.image(x, y, 'fx_q_0').setDepth(4500).setBlendMode('ADD');
      img.setRotation(flip ? a + Math.PI : a).setFlipX(flip).setScale(0.32);
      const keys = ['fx_q_0', 'fx_q_1', 'fx_q_2', 'fx_q_3'];
      keys.forEach((k, j) => this.time.delayedCall(j * 60, () => img.active && img.setTexture(k)));
      this.tweens.add({ targets: img, x: x + Math.cos(a) * range * 0.85, y: y + Math.sin(a) * range * 0.85, scale: 0.5, duration: 280, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: img, alpha: 0, delay: 220, duration: 140, onComplete: () => img.destroy() });
    }
  }

  attachShieldFx(u: Unit, _dur: number) {
    if (!u.shieldFx) {
      const big = u.kind === 'player';
      u.shieldFx = this.add.image(0, 8, big ? 'fx_w_3' : 'fx_w_2').setOrigin(0.5, 0.92).setAlpha(0.6);
      u.shieldFx.setScale((big ? 150 : 84) / u.shieldFx.width);
      u.view.add(u.shieldFx);
    }
    u.shieldFx.setVisible(true);
  }

  bubble(u: Unit, text: string, secs: number) {
    const t = gameText(this, 0, 0, text, 'bubble');
    const w = t.width + 22,
      h = t.height + 12;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.96);
    g.lineStyle(2.5, 0x14213d, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.fillTriangle(-6, h / 2 - 1, 6, h / 2 - 1, 0, h / 2 + 9);
    const c = this.add.container(u.x, u.y - 90, [g, t]).setDepth(7000).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.bubbles.push({ obj: c, unit: u, until: this.simTime + secs });
  }

  private updateBubbles() {
    for (const b of this.bubbles) {
      b.obj.setPosition(b.unit.x, b.unit.y - 90);
      if (this.simTime > b.until || !b.unit.alive) {
        const o = b.obj;
        b.until = -1;
        this.tweens.add({ targets: o, alpha: 0, duration: 200, onComplete: () => o.destroy() });
      }
    }
    this.bubbles = this.bubbles.filter((b) => b.until >= 0);
  }
}
