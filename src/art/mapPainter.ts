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

  // 4) 석조 라인 (베이지 판석)
  for (const l of LANES) strokePoly(ctx, l.path, LANE_HALF_WIDTH * 2 + 10, '#8f7f6c');
  for (const l of LANES) strokePoly(ctx, l.path, LANE_HALF_WIDTH * 2, '#b8a691');
  if (detail) {
    for (const l of LANES) {
      for (let i = 0; i < l.path.length - 1; i++) {
        const a = l.path[i],
          b = l.path[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const nx = -Math.sin(ang),
          ny = Math.cos(ang);
        const step = 34;
        for (let s = 0; s < len; s += step) {
          const row = Math.round(s / step);
          for (let k = -2.5; k <= 2.5; k += 1) {
            const off = (k + (row % 2 ? 0.5 : 0)) * 32;
            if (Math.abs(off) > LANE_HALF_WIDTH - 12) continue;
            const x = a.x + Math.cos(ang) * s + nx * off + (R() - 0.5) * 3;
            const y = a.y + Math.sin(ang) * s + ny * off + (R() - 0.5) * 3;
            const v = R();
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang + (R() - 0.5) * 0.12);
            ctx.fillStyle = `rgb(${222 + v * 18},${200 + v * 16},${182 + v * 14})`;
            ctx.beginPath();
            if ((ctx as any).roundRect) (ctx as any).roundRect(-14, -13, 28, 26, 8);
            else ctx.rect(-14, -13, 28, 26);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.fillRect(-10, -10, 16, 4);
            ctx.restore();
          }
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
      ctx.fillStyle = R() < 0.5 ? 'rgba(120,180,70,0.9)' : 'rgba(90,150,60,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 3 + R() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5) 본진
  paintBase(ctx, ALLY_BASE, true, detail);
  paintBase(ctx, ENEMY_BASE, false, detail);

  // 6) 나무 (이동 불가 지역)
  const trees: { x: number; y: number; r: number; short?: number }[] = [];
  const cell = grid.cell;
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++) {
      if (grid.base[grid.idx(c, r)]) continue;
      // 이동 가능 칸과의 근접도
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
      const chance = near ? 0.95 : 0.42;
      if (R() > chance) continue;
      // 바로 위쪽이 이동 가능 지역이면 길을 가리지 않도록 낮은 나무
      let open = 0;
      for (let k = 1; k <= 3; k++) if (r - k >= 0 && grid.base[grid.idx(c, r - k)]) open = Math.max(open, 4 - k);
      trees.push({ x: (c + 0.5) * cell + (R() - 0.5) * 14, y: (r + 0.5) * cell + (R() - 0.5) * 14, r: (near ? 19 : 26) + R() * 10, short: open } as any);
    }
  trees.sort((a, b) => a.y - b.y);
  const pineG = art.pine && detail ? art.pine : null;
  const pineP = pineG ? tinted(pineG, 'rgba(120,60,170,0.42)') : null;
  const pSize = pineG ? imgSize(pineG) : { w: 1, h: 1 };
  for (const t of trees) {
    // 적 진영 쪽은 보랏빛, 아군 진영 쪽은 녹색
    const enemyness = Math.max(0, Math.min(1, (t.x - t.y + 600) / 2400));
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(t.x + 4, t.y + t.r * 0.55, t.r * 0.95, t.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    if (pineG) {
      const sh = (t as any).short as number;
      const h = t.r * (sh >= 3 ? 1.5 : sh === 2 ? 1.9 : sh === 1 ? 2.4 : 2.9);
      const w = (h * pSize.w) / pSize.h;
      const im = enemyness > 0.55 + (R() - 0.5) * 0.2 ? pineP! : pineG;
      ctx.drawImage(im, t.x - w / 2, t.y + t.r * 0.6 - h, w, h);
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
  ctx.fillStyle = ally ? '#8f7f6c' : '#5a4a6a';
  ctx.beginPath();
  ctx.arc(c.x, c.y, r + 8, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
  if (ally) {
    g.addColorStop(0, '#e9dccb');
    g.addColorStop(1, '#c9b8a2');
  } else {
    g.addColorStop(0, '#8a7a96');
    g.addColorStop(1, '#5e5070');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  const accent = ally ? '#2870ff' : '#6f36ff';
  const trim = ally ? '#f5c542' : '#ff2e4d';
  for (const [rr, w, col, a] of [
    [r - 20, 6, trim, 0.7],
    [r - 60, 14, accent, 0.5],
    [150, 4, trim, 0.6],
    [100, 3, accent, 0.6],
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
    // 바닥 문양: 아군은 금빛 별, 적군은 회로
    ctx.strokeStyle = ally ? 'rgba(245,197,66,0.45)' : 'rgba(255,46,77,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      if (ally) {
        ctx.moveTo(c.x + Math.cos(a) * 160, c.y + Math.sin(a) * 160);
        ctx.lineTo(c.x + Math.cos(a) * (r - 66), c.y + Math.sin(a) * (r - 66));
      } else {
        const r1 = 160,
          r2 = r - 66;
        ctx.moveTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1);
        ctx.lineTo(c.x + Math.cos(a) * (r1 + 40), c.y + Math.sin(a) * (r1 + 40));
        ctx.lineTo(c.x + Math.cos(a + 0.12) * (r1 + 60), c.y + Math.sin(a + 0.12) * (r1 + 60));
        ctx.lineTo(c.x + Math.cos(a + 0.12) * r2, c.y + Math.sin(a + 0.12) * r2);
      }
      ctx.stroke();
      if (!ally) {
        ctx.fillStyle = 'rgba(255,46,77,0.7)';
        ctx.beginPath();
        ctx.arc(c.x + Math.cos(a + 0.12) * (r - 66), c.y + Math.sin(a + 0.12) * (r - 66), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (ally) {
      // 분수(회복 지대)
      const fg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 100);
      fg.addColorStop(0, 'rgba(0,183,255,0.45)');
      fg.addColorStop(1, 'rgba(0,183,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 100, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function mix(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
function rgb(c: number[]) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
