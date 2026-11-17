import Phaser from 'phaser';
import type { LaneRuntime } from '../systems/LaneManager';

export type Side = 'ally' | 'enemy';
export type Kind =
  | 'player' | 'push' | 'dev' | 'biz'
  | 'bug' | 'phishing' | 'ransomware' | 'boss'
  | 'turret' | 'allyTurret' | 'inhibitor' | 'firewall' | 'nexus' | 'allyNexus';

let NEXT_ID = 1;

/** 모든 전투 개체(챔피언·미니언·보스·구조물)의 공통 데이터 + 화면 표시 */
export class Unit {
  readonly id = NEXT_ID++;
  side: Side;
  kind: Kind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive = true;
  isStructure = false;
  invulnerable = false;

  damage = 0;
  interval = 1;
  range = 50;
  speed = 0;
  armor = 1;
  aggro = 200;

  atkTimer = 0;
  scanTimer = Math.random() * 0.25;
  target: Unit | null = null;

  lane: LaneRuntime | null = null;
  s = 0;
  rally = false;
  rallyAngle = 0;
  expireAt = Infinity;
  /** 구조물 저장용 id */
  structId = '';
  specialTimer = 0;

  slowUntil = 0;
  slowMult = 1;
  rootUntil = 0;
  shieldUntil = 0;
  lastHitAt = -99;
  moving = false;
  facing = 1;
  hitFlash = 0;
  attackAnim = 0;
  bobPhase = Math.random() * 10;

  view: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Rectangle | null = null;
  hpFill: Phaser.GameObjects.Rectangle | null = null;
  hpWidth = 0;
  shieldFx: Phaser.GameObjects.Image | null = null;
  extra: Phaser.GameObjects.GameObject[] = [];
  baseScale = 1;
  spriteBaseY = 0;

  constructor(
    scene: Phaser.Scene,
    opts: {
      side: Side; kind: Kind; x: number; y: number; hp: number; radius: number;
      texture: string; displayH: number; hpWidth?: number; hpY?: number; shadowW?: number;
    },
  ) {
    this.side = opts.side;
    this.kind = opts.kind;
    this.x = opts.x;
    this.y = opts.y;
    this.hp = this.maxHp = opts.hp;
    this.radius = opts.radius;

    this.view = scene.add.container(opts.x, opts.y);
    this.shadow = scene.add.image(0, 0, 'fx_shadow');
    const sw = opts.shadowW ?? opts.radius * 2.2;
    this.shadow.setDisplaySize(sw, sw * 0.4);
    this.sprite = scene.add.image(0, 0, opts.texture).setOrigin(0.5, 0.92);
    this.baseScale = opts.displayH / (this.sprite.height || opts.displayH);
    this.sprite.setScale(this.baseScale);
    this.spriteBaseY = 4;
    this.sprite.y = this.spriteBaseY;
    this.view.add([this.shadow, this.sprite]);

    if (opts.hpWidth) {
      this.hpWidth = opts.hpWidth;
      const y = opts.hpY ?? -opts.displayH - 4;
      this.hpBg = scene.add.rectangle(0, y, opts.hpWidth + 4, 8, 0x0b0e17, 0.9).setStrokeStyle(1.5, 0x0b0e17);
      const color = this.side === 'ally' ? 0x00dc84 : 0xff3b5c;
      this.hpFill = scene.add.rectangle(-opts.hpWidth / 2, y, opts.hpWidth, 5, color).setOrigin(0, 0.5);
      this.view.add([this.hpBg, this.hpFill]);
    }
  }

  setHpColor(c: number) {
    this.hpFill?.setFillStyle(c);
  }

  refreshHp() {
    if (!this.hpFill) return;
    const r = Math.max(0, this.hp / this.maxHp);
    this.hpFill.width = this.hpWidth * r;
  }

  dist(o: { x: number; y: number }) {
    return Math.hypot(this.x - o.x, this.y - o.y);
  }

  get isMinion() {
    return !this.isStructure && this.kind !== 'player' && this.kind !== 'boss';
  }

  destroyView() {
    this.shieldFx?.destroy();
    for (const e of this.extra) e.destroy();
    this.view.destroy();
  }
}
