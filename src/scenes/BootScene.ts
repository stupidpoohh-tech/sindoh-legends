import Phaser from 'phaser';
import * as S from '../art/svgs';
import { runtime } from '../config/runtime';
import { SPRITE_KEYS } from '../config/spriteList';
import { bus } from '../core/events';

/**
 * 자산 로딩.
 * 1) public/config/assets.json 의 images[키] 경로 (사용자 교체)
 * 2) public/assets/game/<키>.webp (일러스트 스프라이트, tools/build_sprites.py 로 생성)
 * 3) 둘 다 실패하면 내장 SVG 대체 그래픽
 */
const RES = 2;
type Svg = { svg: () => string; w: number; h: number };
const champ = (p: 'idle' | 'attack' | 'victory'): Svg => ({ svg: () => S.championSvg(p), w: 128, h: 160 });
const push: Svg = { svg: S.minionPushSvg, w: 72, h: 80 };
const dev: Svg = { svg: S.minionDevSvg, w: 72, h: 80 };
const biz: Svg = { svg: S.minionBizSvg, w: 76, h: 80 };
const FALLBACK_RULES: [RegExp, Svg][] = [
  [/^champ_victory$/, champ('victory')],
  [/^champ_atk/, champ('attack')],
  [/^champ_/, champ('idle')],
  [/^m_push/, push],
  [/^m_dev/, dev],
  [/^m_biz/, biz],
  [/^e_bug/, { svg: S.bugSvg, w: 72, h: 60 }],
  [/^e_phish/, { svg: S.phishingSvg, w: 84, h: 72 }],
  [/^e_ransom/, { svg: S.ransomwareSvg, w: 96, h: 104 }],
  [/^boss_/, { svg: S.zeroDaySvg, w: 160, h: 190 }],
  [/^s_ally_turret/, { svg: () => S.turretSvg(true), w: 110, h: 150 }],
  [/^s_turret/, { svg: () => S.turretSvg(false), w: 110, h: 150 }],
  [/^s_inhib/, { svg: S.inhibitorSvg, w: 90, h: 110 }],
  [/^s_ally_nexus/, { svg: () => S.nexusSvg(true), w: 220, h: 220 }],
  [/^s_nexus/, { svg: () => S.nexusSvg(false), w: 220, h: 220 }],
  [/^s_firewall/, { svg: S.firewallSvg, w: 70, h: 100 }],
];
/** 일러스트가 없는 오브젝트(기억 오브젝트)는 SVG 사용 */
const SVG_ONLY: Record<string, Svg> = {
  memory_orb: { svg: S.memoryOrbSvg, w: 64, h: 64 },
  memory_box: { svg: S.memoryBoxSvg, w: 72, h: 64 },
  memory_monument: { svg: S.memoryMonumentSvg, w: 72, h: 100 },
};

export class BootScene extends Phaser.Scene {
  private failed = new Set<string>();
  constructor() {
    super('Boot');
  }

  preload() {
    const overrides = runtime.assets.images || {};
    this.load.on('progress', (v: number) => bus.emit('loading', v * 0.9));
    this.load.on('loaderror', (file: Phaser.Loader.File) => this.failed.add(file.key));
    for (const key of SPRITE_KEYS) this.load.image(key, overrides[key] || `assets/game/${key}.webp`);
    this.load.image('tile_grass', overrides.tile_grass || 'assets/game/tile_grass.webp');
    for (const key of Object.keys(SVG_ONLY)) if (overrides[key]) this.load.image(key, overrides[key]);
  }

  create() {
    let pending = 0;
    const svg = (key: string, a: Svg) => {
      if (this.textures.exists(key)) this.textures.remove(key);
      this.load.svg(key, S.svgDataUrl(a.svg()), { width: a.w * RES, height: a.h * RES });
      pending++;
    };
    for (const key of SPRITE_KEYS) {
      if (this.textures.exists(key) && !this.failed.has(key)) continue;
      const rule = FALLBACK_RULES.find(([re]) => re.test(key));
      if (rule) svg(key, rule[1]);
    }
    for (const [key, a] of Object.entries(SVG_ONLY)) if (!this.textures.exists(key) || this.failed.has(key)) svg(key, a);
    if (this.failed.size) console.warn('[assets] 대체 그래픽 사용:', [...this.failed].join(', '));
    const finish = () => {
      this.makeFxTextures();
      bus.emit('loading', 1);
      bus.emit('boot:ready');
    };
    if (pending) {
      this.load.once('complete', finish);
      this.load.start();
    } else finish();
  }

  /** 이펙트용 텍스처를 캔버스로 생성 */
  private makeFxTextures() {
    const make = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      draw(cv.getContext('2d')!);
      this.textures.addCanvas(key, cv);
    };
    const radial = (c: CanvasRenderingContext2D, s: number, stops: [number, string][]) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      for (const [o, col] of stops) g.addColorStop(o, col);
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    };
    make('fx_shadow', 64, 64, (c) => radial(c, 64, [[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]));
    make('fx_glow', 128, 128, (c) => radial(c, 128, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]));
    make('fx_soft', 128, 128, (c) => radial(c, 128, [[0, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]));
    make('fx_ring', 128, 128, (c) => {
      c.strokeStyle = '#fff';
      c.lineWidth = 7;
      c.beginPath();
      c.arc(64, 64, 58, 0, Math.PI * 2);
      c.stroke();
    });
    make('fx_disc', 128, 128, (c) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(64, 64, 62, 0, Math.PI * 2);
      c.fill();
    });
    make('fx_spark', 32, 32, (c) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.moveTo(16, 0);
      c.lineTo(20, 12);
      c.lineTo(32, 16);
      c.lineTo(20, 20);
      c.lineTo(16, 32);
      c.lineTo(12, 20);
      c.lineTo(0, 16);
      c.lineTo(12, 12);
      c.closePath();
      c.fill();
    });
    make('fx_pixel', 8, 8, (c) => {
      c.fillStyle = '#fff';
      c.fillRect(0, 0, 8, 8);
    });
    make('fx_paper', 28, 34, (c) => {
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#2b2440';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(2, 2);
      c.lineTo(20, 2);
      c.lineTo(26, 8);
      c.lineTo(26, 32);
      c.lineTo(2, 32);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = '#9b87c9';
      for (let y = 12; y < 30; y += 5) {
        c.beginPath();
        c.moveTo(6, y);
        c.lineTo(22, y);
        c.stroke();
      }
    });
    make('fx_bolt', 64, 24, (c) => {
      const g = c.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,1)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(36, 12, 28, 8, 0, 0, Math.PI * 2);
      c.fill();
    });
    make('fx_hex', 128, 128, (c) => {
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(64, 64, 58, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let y = 10; y < 128; y += 18)
        for (let x = 10 + ((y / 18) % 2) * 9; x < 128; x += 18) {
          if (Math.hypot(x - 64, y - 64) > 52) continue;
          c.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            const px = x + Math.cos(a) * 7,
              py = y + Math.sin(a) * 7;
            k ? c.lineTo(px, py) : c.moveTo(px, py);
          }
          c.closePath();
          c.stroke();
        }
      const g = c.createRadialGradient(64, 64, 30, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.35)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(64, 64, 60, 0, Math.PI * 2);
      c.fill();
    });
    make('fx_lock', 40, 44, (c) => {
      c.strokeStyle = '#ffd166';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(20, 18, 10, Math.PI, 0);
      c.stroke();
      c.fillStyle = '#ff2e4d';
      c.strokeStyle = '#141826';
      c.lineWidth = 2.5;
      c.beginPath();
      if ((c as any).roundRect) (c as any).roundRect(5, 18, 30, 22, 4);
      else c.rect(5, 18, 30, 22);
      c.fill();
      c.stroke();
      c.fillStyle = '#141826';
      c.beginPath();
      c.arc(20, 28, 3.5, 0, Math.PI * 2);
      c.fill();
    });
    make('fx_arrow', 64, 64, (c) => {
      c.fillStyle = '#ffe28a';
      c.strokeStyle = '#141826';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(60, 32);
      c.lineTo(20, 8);
      c.lineTo(28, 32);
      c.lineTo(20, 56);
      c.closePath();
      c.fill();
      c.stroke();
    });
  }
}
