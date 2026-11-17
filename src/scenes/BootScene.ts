import Phaser from 'phaser';
import * as S from '../art/svgs';
import { runtime } from '../config/runtime';
import { bus } from '../core/events';

/**
 * 자산 레지스트리: 키 → 내장 SVG(대체 자산) + 표시 크기.
 * assets.json 에 경로가 있으면 그 파일을 먼저 시도하고, 실패하면 내장 SVG를 사용합니다.
 */
const RES = 2; // 확대해도 선명하도록 2배 해상도로 래스터화
export const ASSET_REGISTRY: Record<string, { svg: () => string; w: number; h: number }> = {
  champion_idle: { svg: () => S.championSvg('idle'), w: 128, h: 160 },
  champion_attack: { svg: () => S.championSvg('attack'), w: 128, h: 160 },
  champion_victory: { svg: () => S.championSvg('victory'), w: 128, h: 160 },
  minion_push: { svg: S.minionPushSvg, w: 72, h: 80 },
  minion_dev: { svg: S.minionDevSvg, w: 72, h: 80 },
  minion_biz: { svg: S.minionBizSvg, w: 76, h: 80 },
  enemy_bug: { svg: S.bugSvg, w: 72, h: 60 },
  enemy_phishing: { svg: S.phishingSvg, w: 84, h: 72 },
  enemy_ransomware: { svg: S.ransomwareSvg, w: 96, h: 104 },
  boss_zeroday: { svg: S.zeroDaySvg, w: 160, h: 190 },
  turret_enemy: { svg: () => S.turretSvg(false), w: 110, h: 150 },
  turret_ally: { svg: () => S.turretSvg(true), w: 110, h: 150 },
  inhibitor: { svg: S.inhibitorSvg, w: 90, h: 110 },
  nexus_enemy: { svg: () => S.nexusSvg(false), w: 220, h: 220 },
  nexus_ally: { svg: () => S.nexusSvg(true), w: 220, h: 220 },
  firewall: { svg: S.firewallSvg, w: 70, h: 100 },
  memory_orb: { svg: S.memoryOrbSvg, w: 64, h: 64 },
  memory_box: { svg: S.memoryBoxSvg, w: 72, h: 64 },
  memory_monument: { svg: S.memoryMonumentSvg, w: 72, h: 100 },
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const overrides = runtime.assets.images || {};
    const failed = new Set<string>();
    this.load.on('progress', (v: number) => bus.emit('loading', v * 0.9));
    this.load.on('loaderror', (file: Phaser.Loader.File) => failed.add(file.key));

    // 1차: 사용자가 지정한 교체 이미지 시도
    for (const key of Object.keys(ASSET_REGISTRY)) {
      const url = overrides[key];
      if (url) this.load.image(key, url);
    }
    if (overrides.championFace) this.load.image('champion_face', overrides.championFace);

    this.failed = failed;
  }

  private failed = new Set<string>();

  create() {
    // 2차: 교체 이미지가 없거나 실패한 키는 내장 SVG로 대체
    const overrides = runtime.assets.images || {};
    const failed = this.failed;
    let pending = 0;
    for (const [key, a] of Object.entries(ASSET_REGISTRY)) {
      if (this.textures.exists(key) && !failed.has(key)) continue;
      if (this.textures.exists(key)) this.textures.remove(key);
      pending++;
      this.load.svg(key, S.svgDataUrl(a.svg()), { width: a.w * RES, height: a.h * RES });
    }
    if (overrides.championFace && this.textures.exists('champion_face') && !failed.has('champion_face')) {
      // 얼굴 교체 시: 얼굴 없는 몸체로 다시 그림
      for (const pose of ['idle', 'attack', 'victory'] as const) {
        const key = 'champion_' + pose;
        if (overrides[key] && !failed.has(key)) continue;
        if (this.textures.exists(key)) this.textures.remove(key);
        this.load.svg(key, S.svgDataUrl(S.championSvg(pose, false)), { width: 128 * RES, height: 160 * RES });
        pending++;
      }
    }
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
