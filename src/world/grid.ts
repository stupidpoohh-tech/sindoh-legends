import { WORLD, isWalkableGeom, Pt } from './mapData';

/** 이동 가능 격자 + A* 경로 탐색 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  /** 지형 기준 이동 가능 여부 */
  readonly base: Uint8Array;
  /** 구조물·게이트로 막힌 칸 카운트 */
  readonly blocked: Uint16Array;

  constructor() {
    this.cell = WORLD.cell;
    this.cols = Math.ceil(WORLD.w / this.cell);
    this.rows = Math.ceil(WORLD.h / this.cell);
    this.base = new Uint8Array(this.cols * this.rows);
    this.blocked = new Uint16Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const p = { x: (c + 0.5) * this.cell, y: (r + 0.5) * this.cell };
        this.base[r * this.cols + c] = isWalkableGeom(p) ? 1 : 0;
      }
  }

  idx(c: number, r: number) {
    return r * this.cols + c;
  }
  cellOf(p: Pt) {
    return {
      c: Math.max(0, Math.min(this.cols - 1, Math.floor(p.x / this.cell))),
      r: Math.max(0, Math.min(this.rows - 1, Math.floor(p.y / this.cell))),
    };
  }
  center(c: number, r: number): Pt {
    return { x: (c + 0.5) * this.cell, y: (r + 0.5) * this.cell };
  }
  walkableCell(c: number, r: number) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
    const i = this.idx(c, r);
    return this.base[i] === 1 && this.blocked[i] === 0;
  }
  walkable(p: Pt) {
    const { c, r } = this.cellOf(p);
    return this.walkableCell(c, r);
  }

  /** 원형 영역을 막거나(+1) 해제(-1) */
  setCircleBlocked(p: Pt, radius: number, on: boolean) {
    const r0 = Math.floor((p.y - radius) / this.cell),
      r1 = Math.floor((p.y + radius) / this.cell);
    const c0 = Math.floor((p.x - radius) / this.cell),
      c1 = Math.floor((p.x + radius) / this.cell);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
        const cc = this.center(c, r);
        if (Math.hypot(cc.x - p.x, cc.y - p.y) <= radius) {
          const i = this.idx(c, r);
          this.blocked[i] = on ? this.blocked[i] + 1 : Math.max(0, this.blocked[i] - 1);
        }
      }
  }

  /** 가장 가까운 이동 가능 칸(BFS) */
  nearestWalkable(p: Pt): Pt | null {
    const start = this.cellOf(p);
    if (this.walkableCell(start.c, start.r)) return p;
    const seen = new Uint8Array(this.cols * this.rows);
    const q: number[] = [start.c, start.r];
    seen[this.idx(start.c, start.r)] = 1;
    let head = 0;
    let best: { c: number; r: number } | null = null;
    let bestD = Infinity;
    let foundRing = -1;
    while (head < q.length) {
      const c = q[head++],
        r = q[head++];
      const ring = Math.max(Math.abs(c - start.c), Math.abs(r - start.r));
      if (foundRing >= 0 && ring > foundRing + 1) break;
      if (this.walkableCell(c, r)) {
        const cc = this.center(c, r);
        const d = Math.hypot(cc.x - p.x, cc.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = { c, r };
          if (foundRing < 0) foundRing = ring;
        }
        continue;
      }
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nc = c + dc,
          nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const ni = this.idx(nc, nr);
        if (seen[ni]) continue;
        seen[ni] = 1;
        q.push(nc, nr);
      }
    }
    return best ? this.center(best.c, best.r) : null;
  }

  /** 두 점 사이 직선 이동 가능 여부 */
  lineClear(a: Pt, b: Pt) {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(d / (this.cell * 0.35));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t,
        y = a.y + (b.y - a.y) * t;
      // 캐릭터 몸통 폭을 고려해 좌우도 검사
      if (!this.walkable({ x, y })) return false;
    }
    return true;
  }

  /** A* 탐색. 결과는 월드 좌표 경유점(시작점 제외) */
  findPath(from: Pt, to: Pt): Pt[] | null {
    let goal = to;
    if (!this.walkable(goal)) {
      const n = this.nearestWalkable(goal);
      if (!n) return null;
      goal = n;
    }
    let startP = from;
    if (!this.walkable(startP)) {
      const n = this.nearestWalkable(startP);
      if (!n) return null;
      startP = n;
    }
    if (this.lineClear(startP, goal)) return startP === from ? [goal] : [startP, goal];

    const s = this.cellOf(startP),
      g = this.cellOf(goal);
    const N = this.cols * this.rows;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    const si = this.idx(s.c, s.r),
      gi = this.idx(g.c, g.r);
    gScore[si] = 0;
    heap.push(si, this.h(s.c, s.r, g.c, g.r));
    const dirs = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, 1.4142],
      [1, -1, 1.4142],
      [-1, 1, 1.4142],
      [-1, -1, 1.4142],
    ];
    let found = false;
    let iter = 0;
    while (heap.size && iter++ < 20000) {
      const cur = heap.pop();
      if (cur === gi) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cc = cur % this.cols,
        cr = (cur / this.cols) | 0;
      for (const [dc, dr, cost] of dirs) {
        const nc = cc + dc,
          nr = cr + dr;
        if (!this.walkableCell(nc, nr)) continue;
        // 대각선 이동 시 모서리 끼임 방지
        if (dc && dr && (!this.walkableCell(cc + dc, cr) || !this.walkableCell(cc, cr + dr))) continue;
        const ni = this.idx(nc, nr);
        if (closed[ni]) continue;
        const ng = gScore[cur] + cost;
        if (ng < gScore[ni]) {
          gScore[ni] = ng;
          came[ni] = cur;
          heap.push(ni, ng + this.h(nc, nr, g.c, g.r));
        }
      }
    }
    if (!found) return null;
    const cells: Pt[] = [];
    let cur = gi;
    while (cur !== -1 && cur !== si) {
      cells.push(this.center(cur % this.cols, (cur / this.cols) | 0));
      cur = came[cur];
    }
    cells.reverse();
    cells[cells.length - 1] = goal;
    // 문자열 당기기(string pulling)로 경로 단순화
    const out: Pt[] = [];
    let anchor = startP;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.lineClear(anchor, cells[j])) j--;
      out.push(cells[j]);
      anchor = cells[j];
      i = j + 1;
    }
    if (startP !== from) out.unshift(startP);
    return out;
  }

  private h(c: number, r: number, gc: number, gr: number) {
    const dx = Math.abs(c - gc),
      dy = Math.abs(r - gr);
    return dx + dy + (1.4142 - 2) * Math.min(dx, dy);
  }
}

class MinHeap {
  private ids: number[] = [];
  private pr: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, p: number) {
    this.ids.push(id);
    this.pr.push(p);
    let i = this.ids.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (this.pr[par] <= this.pr[i]) break;
      this.swap(i, par);
      i = par;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!,
      lastP = this.pr.pop()!;
    if (this.ids.length) {
      this.ids[0] = lastId;
      this.pr[0] = lastP;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < this.ids.length && this.pr[l] < this.pr[m]) m = l;
        if (r < this.ids.length && this.pr[r] < this.pr[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.pr[a], this.pr[b]] = [this.pr[b], this.pr[a]];
  }
}
