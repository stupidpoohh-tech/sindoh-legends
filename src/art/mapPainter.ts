import {
  WORLD, LANES, RIVER, JUNGLE_PATHS, CLEARINGS, ALLY_BASE, ENEMY_BASE, BASE_RADIUS, LANE_HALF_WIDTH, Pt,
} from '../world/mapData';
import { NavGrid } from '../world/grid';

/** 결정적 난수 (매번 같은 맵) */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function strokePoly(ctx: CanvasRenderingContext2D, pts: Pt[], width: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/**
 * 협곡 전체를 캔버스에 그립니다. 결과 캔버스는 Phaser 텍스처 조각으로 잘라 사용합니다.
 * scale < 1 이면 미니맵용 축소판을 그립니다.
 */
export interface MapArt {
  grass?: CanvasImageSource;
  pine?: CanvasImageSource;
  group?: CanvasImageSource;
}

function imgSize(im: CanvasImageSource) {
  const a = im as any;
  return { w: a.naturalWidth || a.width || 1, h: a.naturalHeight || a.height || 1 };
}

/** 보랏빛으로 물든 나무 (적 진영 쪽) */
function tinted(im: CanvasImageSource, color: string) {
  const { w, h } = imgSize(im);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = color;
  x.fillRect(0, 0, w, h);
  return c;
}

export function paintMap(grid: NavGrid, scale = 1, art: MapArt = {}): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round(WORLD.w * scale);
  cv.height = Math.round(WORLD.h * scale);
  const ctx = cv.getContext('2d')!;
  ctx.scale(scale, scale);
  const R = rng(20251117);
  const detail = scale >= 0.5;
  const grassFill: string | CanvasPattern = (art.grass && ctx.createPattern(art.grass, 'repeat')) || '#7cc04a';

  // 1) 숲 바닥 (이동 불가 지역)
  const bg = ctx.createLinearGradient(0, WORLD.h, WORLD.w, 0);
  bg.addColorStop(0, '#2f6a2c');
  bg.addColorStop(0.55, '#2c5f2c');
  bg.addColorStop(1, '#3b3a5c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // 2) 이동 가능 지역의 초원 (타일 패턴)
  const grassStroke = (pts: Pt[], w: number) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = w;
    ctx.strokeStyle = grassFill;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  const grassCircle = (c: Pt, r: number) => {
    ctx.fillStyle = grassFill;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const l of LANES) grassStroke(l.path, LANE_HALF_WIDTH * 2 + 44);
  for (const j of JUNGLE_PATHS) grassStroke(j.pts, j.half * 2 + 20);
  for (const c of CLEARINGS) grassCircle(c.c, c.r + 14);
  grassStroke([RIVER.from, RIVER.to], RIVER.half * 2 + 40);
  grassCircle(ALLY_BASE, BASE_RADIUS + 30);
  grassCircle(ENEMY_BASE, BASE_RADIUS + 30);
  // 적 진영 쪽 초원은 보랏빛 그늘
  const shade = ctx.createLinearGradient(1200, 1200, 2400, 0);
  shade.addColorStop(0, 'rgba(70,30,110,0)');
  shade.addColorStop(1, 'rgba(70,30,110,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // 3) 강
  strokePoly(ctx, [RIVER.from, RIVER.to], RIVER.half * 2 + 10, '#5f8f6a');
  strokePoly(ctx, [RIVER.from, RIVER.to], RIVER.half * 2, '#2f8fc9');
  strokePoly(ctx, [RIVER.from, RIVER.to], RIVER.half * 1.1, '#46b0e6');
  if (detail)
    for (let i = 0; i < 160; i++) {
      const t = R();
      const x = RIVER.from.x + (RIVER.to.x - RIVER.from.x) * t + (R() - 0.5) * 80;
      const y = RIVER.from.y + (RIVER.to.y - RIVER.from.y) * t + (R() - 0.5) * 80;
      ctx.strokeStyle = 'rgba(230,250,255,0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 10);
      ctx.quadraticCurveTo(x, y + 4, x + 10, y - 10);
      ctx.stroke();
    }

  // 정글 오솔길 (흙길)
  for (const j of JUNGLE_PATHS) strokePoly(ctx, j.pts, j.half * 0.9, 'rgba(176,140,96,0.55)');

  // 4) 석조 라인 — 밝기·채도를 낮춘 판석, 흙 가장자리와 줄눈 그림자
  for (const l of LANES) strokePoly(ctx, l.path, LANE_HALF_WIDTH * 2 + 30, 'rgba(112,88,58,0.45)'); // 흙 띠
  for (const l of LANES) strokePoly(ctx, l.path, LANE_HALF_WIDTH * 2 + 8, '#6f6354'); // 가장자리 그늘
  for (const l of LANES) strokePoly(ctx, l.path, LANE_HALF_WIDTH * 2 - 4, '#8f8372'); // 줄눈 바탕
  if (detail) {
    for (const l of LANES) {
      for (let i = 0; i < l.path.length - 1; i++) {
        const a = l.path[i],
          b = l.path[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const nx = -Math.sin(ang),
          ny = Math.cos(ang);
        let s = 0,
          row = 0;
        while (s < len) {
          const rowLen = 28 + R() * 10; // 줄마다 판석 길이 변화
          let off = -LANE_HALF_WIDTH + 10 + (row % 2 ? 8 : 0) + R() * 6;
          while (off < LANE_HALF_WIDTH - 12) {
            const tw = 24 + R() * 14; // 판석 너비 변화
            const cx = off + tw / 2;
            if (cx > LANE_HALF_WIDTH - 14) break;
            const x = a.x + Math.cos(ang) * (s + rowLen / 2) + nx * cx;
            const y = a.y + Math.sin(ang) * (s + rowLen / 2) + ny * cx;
            const v = R();
            const moss = R() < 0.06;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang + (R() - 0.5) * 0.1);
            const w = rowLen - 4,
              h = tw - 4;
            ctx.fillStyle = 'rgba(40,32,22,0.22)'; // 판석 아래쪽 그림자
            ctx.beginPath();
            if ((ctx as any).roundRect) (ctx as any).roundRect(-w / 2 + 1, -h / 2 + 2, w, h, 6);
            else ctx.rect(-w / 2 + 1, -h / 2 + 2, w, h);
            ctx.fill();
            const base = moss ? [168, 170, 132] : [190 + v * 16, 178 + v * 14, 160 + v * 12];
            ctx.fillStyle = `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`;
            ctx.beginPath();
            if ((ctx as any).roundRect) (ctx as any).roundRect(-w / 2, -h / 2, w, h, 6);
            else ctx.rect(-w / 2, -h / 2, w, h);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,250,235,0.12)';
            ctx.fillRect(-w / 2 + 4, -h / 2 + 3, w - 10, 3);
            ctx.restore();
            off += tw;
          }
          s += rowLen;
          row++;
        }
      }
    }
    // 라인 가장자리 풀
    for (let i = 0; i < 1100; i++) {
      const l = LANES[i % 3];
      const t = R();
      const seg = Math.floor(t * (l.path.length - 1));
      const a = l.path[seg],
        b = l.path[seg + 1];
      const u = R();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const side = R() < 0.5 ? -1 : 1;
      const off = side * (LANE_HALF_WIDTH - 2 - R() * 8);
      const x = a.x + (b.x - a.x) * u - Math.sin(ang) * off;
      const y = a.y + (b.y - a.y) * u + Math.cos(ang) * off;
      ctx.fillStyle = R() < 0.5 ? 'rgba(104,156,64,0.85)' : 'rgba(84,134,56,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, 3 + R() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5) 본진
  paintBase(ctx, ALLY_BASE, true, detail);
  paintBase(ctx, ENEMY_BASE, false, detail);

  // 6) 나무 (이동 불가 지역) — 고정 시드 + 밀도 노이즈로 작은 빈터, 크기·방향·색조 변화
  type Tree = { x: number; y: number; r: number; short: number; flip: boolean; tone: number };
  const trees: Tree[] = [];
  const fill: { x: number; y: number; kind: 'bush' | 'rock' }[] = [];
  const cell = grid.cell;
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++) {
      if (grid.base[grid.idx(c, r)]) continue;
      let near = false;
      for (let dr = -1; dr <= 1 && !near; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nc = c + dc,
            nr = r + dr;
          if (nc >= 0 && nr >= 0 && nc < grid.cols && nr < grid.rows && grid.base[grid.idx(nc, nr)]) {
            near = true;
            break;
          }
        }
      const x0 = (c + 0.5) * cell,
        y0 = (r + 0.5) * cell;
      // 길 가장자리는 촘촘하게(경계 명확), 숲 안쪽은 노이즈로 빈터를 만든다
      const dens = valueNoise(x0 / 210, y0 / 210);
      const chance = near ? 0.9 : dens < 0.34 ? 0.08 : 0.24 + dens * 0.32;
      if (R() > chance) {
        if (!near && dens < 0.34 && R() < 0.35) fill.push({ x: x0 + (R() - 0.5) * 20, y: y0 + (R() - 0.5) * 20, kind: R() < 0.7 ? 'bush' : 'rock' });
        continue;
      }
      let open = 0;
      for (let k = 1; k <= 3; k++) if (r - k >= 0 && grid.base[grid.idx(c, r - k)]) open = Math.max(open, 4 - k);
      trees.push({
        x: x0 + (R() - 0.5) * 20,
        y: y0 + (R() - 0.5) * 16,
        r: (near ? 18 : 24) * (0.86 + R() * 0.34),
        short: open,
        flip: R() < 0.5,
        tone: Math.floor(R() * 3),
      });
    }
  trees.sort((a, b) => a.y - b.y);
  const pineG = art.pine && detail ? art.pine : null;
  // 색조 3종(기본·짙은·밝은) × 진영 2종 — 같은 나무를 반복한 느낌 완화
  const pineVariants = pineG
    ? [
        [pineG, tinted(pineG, 'rgba(10,40,30,0.22)'), tinted(pineG, 'rgba(190,210,90,0.16)')],
        [tinted(pineG, 'rgba(110,55,160,0.42)'), tinted(pineG, 'rgba(60,30,100,0.5)'), tinted(pineG, 'rgba(150,90,190,0.36)')],
      ]
    : null;
  const pSize = pineG ? imgSize(pineG) : { w: 1, h: 1 };
  // 빈터 관목·바위 (나무보다 먼저, 그림자 포함)
  for (const f of fill) {
    const enemyF = (f.x - f.y + 600) / 2400 > 0.55;
    ctx.fillStyle = 'rgba(8,24,14,0.3)';
    ctx.beginPath();
    ctx.ellipse(f.x + 3, f.y + 7, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (f.kind === 'bush') {
      const base = enemyF ? [86, 70, 120] : [66, 128, 58];
      for (let k = 0; k < 4; k++) {
        const bx = f.x + (k - 1.5) * 7 + (R() - 0.5) * 4,
          by = f.y - (k % 2) * 6;
        ctx.fillStyle = rgb(mix(base, [255, 255, 200], 0.06 * k));
        ctx.beginPath();
        ctx.arc(bx, by, 9 + R() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,220,0.16)';
      ctx.beginPath();
      ctx.arc(f.x - 5, f.y - 8, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#7f7f86';
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, 13, 9, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a5a6ad';
      ctx.beginPath();
      ctx.ellipse(f.x - 3, f.y - 3, 7, 4, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const t of trees) {
    const enemyness = Math.max(0, Math.min(1, (t.x - t.y + 600) / 2400));
    // 접지 그림자: 모든 개체 공통 — 위쪽 광원, 오른쪽 아래로 살짝
    ctx.fillStyle = 'rgba(6,22,12,0.32)';
    ctx.beginPath();
    ctx.ellipse(t.x + 4, t.y + t.r * 0.5, t.r * 0.9, t.r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    if (pineVariants) {
      const h = t.r * (t.short >= 3 ? 1.5 : t.short === 2 ? 1.9 : t.short === 1 ? 2.4 : 2.8);
      const w = (h * pSize.w) / pSize.h;
      const side = enemyness > 0.55 ? 1 : 0;
      const im = pineVariants[side][t.tone];
      if (t.flip) {
        ctx.save();
        ctx.translate(t.x, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(im, -w / 2, t.y + t.r * 0.6 - h, w, h);
        ctx.restore();
      } else ctx.drawImage(im, t.x - w / 2, t.y + t.r * 0.6 - h, w, h);
      continue;
    }
    const g1 = mix([40, 110, 60], [80, 50, 120], enemyness * 0.8);
    const g2 = mix([70, 150, 80], [110, 80, 150], enemyness * 0.8);
    ctx.fillStyle = rgb(g1);
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    if (detail) {
      ctx.fillStyle = rgb(g2);
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 숲 가장자리 장식 (바위·덤불·꽃)
  if (art.group && detail) {
    const gs = imgSize(art.group);
    for (let i = 0; i < 70; i++) {
      const c = Math.floor(R() * grid.cols),
        r = Math.floor(R() * grid.rows);
      if (grid.base[grid.idx(c, r)]) continue;
      // 이동 가능 지역 바로 옆에만
      if (!(grid.base[grid.idx(Math.min(grid.cols - 1, c + 1), r)] || grid.base[grid.idx(c, Math.min(grid.rows - 1, r + 1))])) continue;
      const h = 70 + R() * 30,
        w = (h * gs.w) / gs.h;
      const x = (c + 0.5) * grid.cell,
        y = (r + 0.5) * grid.cell;
      ctx.drawImage(art.group, x - w / 2, y + 20 - h, w, h);
    }
  }

  // 7) 바위·꽃 장식
  if (detail)
    for (let i = 0; i < 260; i++) {
      const p = { x: R() * WORLD.w, y: R() * WORLD.h };
      if (!grid.walkable(p)) continue;
      let onLane = false;
      for (const l of LANES) {
        for (let k = 0; k < l.path.length - 1; k++) {
          const a = l.path[k],
            b = l.path[k + 1];
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const tt = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
          if (Math.hypot(p.x - a.x - tt * dx, p.y - a.y - tt * dy) < LANE_HALF_WIDTH) onLane = true;
        }
      }
      if (onLane) continue;
      if (R() < 0.5) {
        ctx.fillStyle = ['#ffe28a', '#e58cf0', '#ffffff'][Math.floor(R() * 3)];
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(p.x + (R() - 0.5) * 14, p.y + (R() - 0.5) * 10, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#8d8f99';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b5b7c0';
        ctx.beginPath();
        ctx.ellipse(p.x - 2, p.y - 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

  // 8) 가장자리 비네팅
  const vg = ctx.createRadialGradient(WORLD.w / 2, WORLD.h / 2, WORLD.w * 0.45, WORLD.w / 2, WORLD.h / 2, WORLD.w * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  return cv;
}

function paintBase(ctx: CanvasRenderingContext2D, c: Pt, ally: boolean, detail: boolean) {
  const r = BASE_RADIUS;
  const R = rng(ally ? 7 : 13);
  // 외곽 그늘 + 테두리 깊이
  ctx.fillStyle = 'rgba(20,16,10,0.35)';
  ctx.beginPath();
  ctx.arc(c.x + 3, c.y + 8, r + 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ally ? '#6c6152' : '#46394f';
  ctx.beginPath();
  ctx.arc(c.x, c.y, r + 10, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(c.x, c.y - 40, 0, c.x, c.y, r);
  if (ally) {
    g.addColorStop(0, '#d8cbb6');
    g.addColorStop(1, '#b4a48d');
  } else {
    g.addColorStop(0, '#7e6f8a');
    g.addColorStop(1, '#584a66');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  if (detail) {
    // 석재 블록 링 (바깥 2줄) + 안쪽 동심 판석
    const rings = [
      [r - 4, r - 44, 40],
      [r - 44, r - 84, 32],
      [210, 160, 26],
    ];
    for (const [ro, ri, n] of rings) {
      const off = R() * Math.PI;
      for (let i = 0; i < n; i++) {
        const a0 = off + (i / n) * Math.PI * 2,
          a1 = off + ((i + 1) / n) * Math.PI * 2 - 0.012 * (300 / ro);
        const v = R();
        ctx.fillStyle = ally ? `rgba(${200 + v * 24},${186 + v * 20},${164 + v * 18},0.9)` : `rgba(${118 + v * 22},${100 + v * 18},${132 + v * 20},0.9)`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, ro - 2, a0, a1);
        ctx.arc(c.x, c.y, ri + 2, a1, a0, true);
        ctx.closePath();
        ctx.fill();
      }
    }
    // 테두리 하이라이트·그림자 (베벨)
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,248,230,0.28)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, r - 3, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,20,10,0.3)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, r - 3, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
  }
  const accent = ally ? '#3f74d8' : '#7a4ad8';
  const trim = ally ? '#d9b04c' : '#d8455f';
  for (const [rr, w, col, a] of [
    [r - 44, 4, trim, 0.75],
    [r - 86, 8, accent, 0.45],
    [158, 3, trim, 0.6],
    [100, 3, accent, 0.5],
  ] as [number, number, string, number][]) {
    ctx.globalAlpha = a;
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (detail) {
    // 진영 문양: 아군은 금빛 방사선, 적군은 회로 (약하게 — 경고 표시를 가리지 않도록)
    ctx.strokeStyle = ally ? 'rgba(217,176,76,0.38)' : 'rgba(216,69,95,0.42)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      if (ally) {
        ctx.moveTo(c.x + Math.cos(a) * 160, c.y + Math.sin(a) * 160);
        ctx.lineTo(c.x + Math.cos(a) * (r - 88), c.y + Math.sin(a) * (r - 88));
      } else {
        const r1 = 160,
          r2 = r - 88;
        ctx.moveTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1);
        ctx.lineTo(c.x + Math.cos(a) * (r1 + 30), c.y + Math.sin(a) * (r1 + 30));
        ctx.lineTo(c.x + Math.cos(a + 0.1) * r2, c.y + Math.sin(a + 0.1) * r2);
      }
      ctx.stroke();
    }
    if (ally) {
      const fg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 100);
      fg.addColorStop(0, 'rgba(0,183,255,0.32)');
      fg.addColorStop(1, 'rgba(0,183,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 100, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** 고정 해시 기반 값 노이즈 (0~1) — 매 접속마다 같은 숲 배치 */
function hash2(x: number, y: number) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function valueNoise(x: number, y: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi),
    b = hash2(xi + 1, yi),
    c = hash2(xi, yi + 1),
    d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function mix(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
function rgb(c: number[]) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
