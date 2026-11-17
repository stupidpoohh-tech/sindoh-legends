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
export function paintMap(grid: NavGrid, scale = 1): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round(WORLD.w * scale);
  cv.height = Math.round(WORLD.h * scale);
  const ctx = cv.getContext('2d')!;
  ctx.scale(scale, scale);
  const R = rng(20251117);
  const detail = scale >= 0.5;

  // 1) 숲 바닥
  const bg = ctx.createLinearGradient(0, WORLD.h, WORLD.w, 0);
  bg.addColorStop(0, '#13321f');
  bg.addColorStop(0.5, '#10291b');
  bg.addColorStop(1, '#1a1830');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  if (detail)
    for (let i = 0; i < 900; i++) {
      const x = R() * WORLD.w,
        y = R() * WORLD.h,
        r = 20 + R() * 60;
      ctx.fillStyle = R() < 0.5 ? 'rgba(40,80,45,0.18)' : 'rgba(5,20,12,0.25)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

  // 2) 강
  strokePoly(ctx, [RIVER.from, RIVER.to], RIVER.half * 2 + 22, '#2a3b2f');
  strokePoly(ctx, [RIVER.from, RIVER.to], RIVER.half * 2, '#1f5866');
  strokePoly(ctx, [RIVER.from, RIVER.to], RIVER.half * 1.2, '#26707f');
  if (detail)
    for (let i = 0; i < 160; i++) {
      const t = R();
      const x = RIVER.from.x + (RIVER.to.x - RIVER.from.x) * t + (R() - 0.5) * 80;
      const y = RIVER.from.y + (RIVER.to.y - RIVER.from.y) * t + (R() - 0.5) * 80;
      ctx.strokeStyle = 'rgba(180,240,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 10);
      ctx.quadraticCurveTo(x, y + 4, x + 10, y - 10);
      ctx.stroke();
    }

  // 3) 정글 길과 공터
  for (const j of JUNGLE_PATHS) strokePoly(ctx, j.pts, j.half * 2 + 16, '#2b3a24');
  for (const c of CLEARINGS) {
    ctx.fillStyle = '#2b3a24';
    ctx.beginPath();
    ctx.arc(c.c.x, c.c.y, c.r + 8, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const j of JUNGLE_PATHS) strokePoly(ctx, j.pts, j.half * 2, '#4a4630');
  for (const c of CLEARINGS) {
    const g = ctx.createRadialGradient(c.c.x, c.c.y, 0, c.c.x, c.c.y, c.r);
    g.addColorStop(0, '#5a5538');
    g.addColorStop(1, '#4a4630');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.c.x, c.c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (detail)
    for (let i = 0; i < 500; i++) {
      const p = { x: R() * WORLD.w, y: R() * WORLD.h };
      if (!grid.walkable(p)) continue;
      ctx.fillStyle = 'rgba(90,120,60,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 6 + R() * 10, 3 + R() * 5, R() * 3, 0, Math.PI * 2);
      ctx.fill();
    }

  // 4) 석조 라인
  for (const l of LANES) strokePoly(ctx, l.path, LANE_HALF_WIDTH * 2 + 18, '#22252c');
  for (const l of LANES) strokePoly(ctx, l.path, LANE_HALF_WIDTH * 2, '#4c4f59');
  if (detail) {
    for (const l of LANES) {
      for (let i = 0; i < l.path.length - 1; i++) {
        const a = l.path[i],
          b = l.path[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const nx = -Math.sin(ang),
          ny = Math.cos(ang);
        const step = 28;
        for (let s = 0; s < len; s += step) {
          const row = Math.round(s / step);
          for (let k = -2.5; k <= 2.5; k += 1) {
            const off = (k + (row % 2 ? 0.5 : 0)) * 28;
            if (Math.abs(off) > LANE_HALF_WIDTH - 10) continue;
            const x = a.x + Math.cos(ang) * s + nx * off;
            const y = a.y + Math.sin(ang) * s + ny * off;
            const v = 82 + Math.floor(R() * 26);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang);
            ctx.fillStyle = `rgb(${v},${v + 2},${v + 12})`;
            ctx.beginPath();
            if ((ctx as any).roundRect) (ctx as any).roundRect(-12, -12, 24, 24, 4);
            else ctx.rect(-12, -12, 24, 24);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(-11, -11, 22, 5);
            ctx.restore();
          }
        }
      }
    }
    // 라인 가장자리의 이끼
    for (let i = 0; i < 900; i++) {
      const l = LANES[i % 3];
      const t = R();
      const seg = Math.floor(t * (l.path.length - 1));
      const a = l.path[seg],
        b = l.path[seg + 1];
      const u = R();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const side = R() < 0.5 ? -1 : 1;
      const off = side * (LANE_HALF_WIDTH - 4 - R() * 14);
      const x = a.x + (b.x - a.x) * u - Math.sin(ang) * off;
      const y = a.y + (b.y - a.y) * u + Math.cos(ang) * off;
      ctx.fillStyle = R() < 0.5 ? 'rgba(60,110,50,0.55)' : 'rgba(40,80,40,0.55)';
      ctx.beginPath();
      ctx.arc(x, y, 4 + R() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5) 본진
  paintBase(ctx, ALLY_BASE, true, detail);
  paintBase(ctx, ENEMY_BASE, false, detail);

  // 6) 나무 (이동 불가 지역)
  const trees: { x: number; y: number; r: number }[] = [];
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
      trees.push({ x: (c + 0.5) * cell + (R() - 0.5) * 14, y: (r + 0.5) * cell + (R() - 0.5) * 14, r: (near ? 19 : 26) + R() * 10 });
    }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) {
    // 적 진영 쪽은 보랏빛, 아군 진영 쪽은 녹색
    const enemyness = Math.max(0, Math.min(1, (t.x - t.y + 600) / 2400));
    const g1 = mix([22, 70, 38], [56, 30, 80], enemyness * 0.8);
    const g2 = mix([40, 105, 52], [86, 52, 120], enemyness * 0.8);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(t.x + 4, t.y + t.r * 0.55, t.r * 0.95, t.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgb(g1);
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    if (detail) {
      ctx.fillStyle = rgb(g2);
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.38, t.y - t.r * 0.4, t.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
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
        ctx.fillStyle = ['#ffe28a', '#ff9ecb', '#bff0ff'][Math.floor(R() * 3)];
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(p.x + (R() - 0.5) * 14, p.y + (R() - 0.5) * 10, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#5d6070';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7d8192';
        ctx.beginPath();
        ctx.ellipse(p.x - 2, p.y - 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

  // 8) 가장자리 비네팅
  const vg = ctx.createRadialGradient(WORLD.w / 2, WORLD.h / 2, WORLD.w * 0.45, WORLD.w / 2, WORLD.h / 2, WORLD.w * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  return cv;
}

function paintBase(ctx: CanvasRenderingContext2D, c: Pt, ally: boolean, detail: boolean) {
  const r = BASE_RADIUS;
  ctx.fillStyle = '#22252c';
  ctx.beginPath();
  ctx.arc(c.x, c.y, r + 6, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
  if (ally) {
    g.addColorStop(0, '#5f6a86');
    g.addColorStop(1, '#3d4458');
  } else {
    g.addColorStop(0, '#4a3a62');
    g.addColorStop(1, '#2a2238');
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
