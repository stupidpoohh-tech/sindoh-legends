import { BALANCE } from '../config/balance';
import { LANES, LaneDef, Polyline, distToPolyline, Pt } from '../world/mapData';
import type { Unit, Kind } from '../entities/Unit';

export interface LaneHost {
  units: Unit[];
  player: Unit;
  spawnLaneUnit(lane: LaneRuntime, kind: Kind, s: number, empowered: boolean): Unit | null;
  removeUnitQuiet(u: Unit): void;
  enemyWavesEnabled(): boolean;
}

/** 라인 하나의 진행 상태. 화면 밖(비활성)일 때는 전선 위치만 단순 계산 */
export class LaneRuntime {
  readonly def: LaneDef;
  readonly poly: Polyline;
  readonly sAllyTurret: number;
  readonly sEnemyTurret: number;
  readonly sInhib: number;
  readonly sGate: number;
  front: number;
  active = true;
  spawnTimer: number;
  waveCount = 0;
  turretAlive = true;
  inhibAlive = true;
  gateOpen = false;
  greeted = false;

  constructor(def: LaneDef) {
    this.def = def;
    this.poly = new Polyline(def.path);
    this.sAllyTurret = this.poly.project(def.allyTurret);
    this.sEnemyTurret = this.poly.project(def.enemyTurret);
    this.sInhib = this.poly.project(def.inhibitor);
    this.sGate = this.poly.project(def.gate);
    this.front = (this.sAllyTurret + this.sEnemyTurret) / 2;
    this.spawnTimer = BALANCE.minionWave.firstDelay;
  }

  get allyKind(): Kind {
    return this.def.team;
  }
  /** 아군 미니언이 멈추는 지점 */
  get allyStopS() {
    return this.gateOpen ? this.poly.length - 40 : this.sGate - 70;
  }
  get enemySpawnS() {
    return this.sGate + 50;
  }
  /** 비활성 상태에서 전선이 수렴하는 균형점 */
  get equilibrium() {
    const enemyWall = this.turretAlive ? this.sEnemyTurret - 260 : this.inhibAlive ? this.sInhib - 230 : this.sGate - 160;
    return Math.max(this.sAllyTurret + 220, enemyWall);
  }
  point(s: number): Pt {
    return this.poly.at(s);
  }
}

export class LaneManager {
  readonly lanes: LaneRuntime[];
  private checkTimer = 0;

  constructor(private host: LaneHost) {
    this.lanes = LANES.map((d) => new LaneRuntime(d));
  }

  byId(id: string) {
    return this.lanes.find((l) => l.def.id === id)!;
  }

  update(dt: number) {
    const B = BALANCE.minionWave;
    this.checkTimer -= dt;
    if (this.checkTimer <= 0) {
      this.checkTimer = 0.5;
      for (const lane of this.lanes) this.updateActivity(lane);
    }
    for (const lane of this.lanes) {
      if (!lane.active) {
        // 경량 계산: 전선 위치만 균형점을 향해 이동
        const eq = lane.equilibrium;
        const d = eq - lane.front;
        lane.front += Math.sign(d) * Math.min(Math.abs(d), B.dormantDrift * dt);
        continue;
      }
      this.trackFront(lane);
      lane.spawnTimer -= dt;
      if (lane.spawnTimer <= 0) {
        lane.spawnTimer = B.interval;
        this.spawnWave(lane, null);
      }
    }
  }

  private laneUnits(lane: LaneRuntime) {
    return this.host.units.filter((u) => u.alive && u.lane === lane && !u.rally && !u.captain);
  }

  private updateActivity(lane: LaneRuntime) {
    const p = this.host.player;
    const near =
      distToPolyline(p, lane.def.path) < BALANCE.minionWave.activeLaneDistance ||
      Math.hypot(p.x - lane.point(lane.front).x, p.y - lane.point(lane.front).y) < 900;
    if (near === lane.active) return;
    lane.active = near;
    if (!near) {
      // 비활성화: 전선 위치 기록 후 미니언 정리
      this.trackFront(lane);
      for (const u of this.laneUnits(lane)) this.host.removeUnitQuiet(u);
    } else {
      // 재활성화: 기록된 전선 위치에 교전 상태를 복원
      const f = Math.max(lane.sAllyTurret + 120, Math.min(lane.front, lane.allyStopS));
      this.spawnWave(lane, f);
      lane.spawnTimer = BALANCE.minionWave.interval * 0.6;
    }
  }

  private trackFront(lane: LaneRuntime) {
    let maxA = -1,
      minE = Infinity;
    for (const u of this.host.units) {
      if (!u.alive || u.lane !== lane || u.rally || u.captain) continue;
      if (u.side === 'ally') maxA = Math.max(maxA, u.s);
      else minE = Math.min(minE, u.s);
    }
    if (maxA >= 0 && minE < Infinity) lane.front = (maxA + minE) / 2;
    else if (maxA >= 0) lane.front = maxA;
    else if (minE < Infinity) lane.front = minE;
  }

  /** 웨이브 생성. at 이 주어지면 그 전선 주변에서 즉시 교전 상태로 생성 */
  spawnWave(lane: LaneRuntime, at: number | null) {
    const cap = BALANCE.minionWave.maxUnits;
    const count = this.host.units.filter((u) => u.alive && !u.isStructure).length;
    if (count > cap - 6) return;
    lane.waveCount++;
    const allyKinds = [...BALANCE.allyWaves[lane.def.team]] as Kind[];
    const enemyKinds: Kind[] = ['bug', 'bug', 'phishing'];
    const empowered = lane.inhibAlive;
    if (empowered && lane.waveCount % BALANCE.enemyUnits.ransomwareEveryWaves === 0) enemyKinds.push('ransomware');

    const allyStart = at !== null ? at - 110 : 0;
    allyKinds.forEach((k, i) => this.host.spawnLaneUnit(lane, k, Math.max(0, allyStart - i * 34), false));
    if (this.host.enemyWavesEnabled()) {
      const enemyStart = at !== null ? Math.min(at + 110, lane.enemySpawnS) : lane.enemySpawnS;
      enemyKinds.forEach((k, i) => this.host.spawnLaneUnit(lane, k, enemyStart + i * 34, empowered));
    }
  }
}
