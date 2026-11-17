import { bus } from './events';

export enum GameState {
  TITLE = 'TITLE',
  LOADING = 'LOADING',
  INTRO = 'INTRO',
  TUTORIAL = 'TUTORIAL',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  BOSS_BATTLE = 'BOSS_BATTLE',
  NEXUS_BATTLE = 'NEXUS_BATTLE',
  VICTORY = 'VICTORY',
  ARCHIVE = 'ARCHIVE',
  VIDEO = 'VIDEO',
}

/** 게임 진행을 멈추는 '덮개' 상태 */
const OVERLAY = new Set([GameState.PAUSED, GameState.ARCHIVE, GameState.VIDEO]);
/** 월드 시뮬레이션이 돌아가는 상태 */
const RUNNING = new Set([GameState.TUTORIAL, GameState.PLAYING, GameState.BOSS_BATTLE, GameState.NEXUS_BATTLE]);

class StateMachine {
  private _state: GameState = GameState.LOADING;
  /** 덮개 상태 아래 깔린 상태들 (일시정지 → 기록관 → 영상 순으로 쌓일 수 있음) */
  private stack: GameState[] = [];

  get state() {
    return this._state;
  }
  get isRunning() {
    return RUNNING.has(this._state);
  }
  /** 덮개 아래의 실제 진행 상태 */
  get baseState() {
    return this.stack.length ? this.stack[0] : this._state;
  }

  /** 일반 전환. 같은 상태로의 중복 전환은 무시 */
  set(next: GameState) {
    if (next === this._state) return false;
    const prev = this._state;
    this._state = next;
    if (!OVERLAY.has(next)) this.stack = [];
    bus.emit('state', { prev, next });
    return true;
  }

  /** 덮개 상태 열기 */
  push(next: GameState) {
    if (next === this._state) return false;
    this.stack.push(this._state);
    const prev = this._state;
    this._state = next;
    bus.emit('state', { prev, next });
    return true;
  }

  /** 덮개 상태 닫기 → 이전 상태로 복귀 */
  pop() {
    if (!this.stack.length) return false;
    const prev = this._state;
    this._state = this.stack.pop()!;
    bus.emit('state', { prev, next: this._state });
    return true;
  }
}

export const fsm = new StateMachine();
