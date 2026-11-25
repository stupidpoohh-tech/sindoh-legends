import { ver } from '../core/assetVersion';
import { runtime } from '../config/runtime';
import { save } from '../core/save';

/**
 * 사운드 엔진.
 * - 기본: Web Audio API로 효과음·배경음악을 실시간 합성 (외부 음원 불필요, 저작권 문제 없음)
 * - public/config/assets.json 의 audio 항목에 파일을 지정하면 해당 파일 우선 재생
 * - 브라우저 자동재생 제한 때문에 '협곡 입장' 버튼 입력 이후에만 활성화
 */
type Sfx =
  | 'attack' | 'hit' | 'q' | 'w' | 'r' | 'turretShot' | 'explode' | 'turretDestroy' | 'levelup'
  | 'bossAppear' | 'bossShot' | 'bossAoe' | 'victory' | 'memory' | 'click' | 'welcome' | 'summon' | 'lock' | 'warn';

/** 스킬 효과음 증폭 배율 (리미터를 거쳐 찢어지지 않게 키움) */
const SKILL_FILE_GAIN: Partial<Record<Sfx, number>> = { q: 2.6, w: 3.0, r: 2.8 };
const FILE_KEY: Partial<Record<Sfx, string>> = {
  attack: 'sfx_attack',
  q: 'sfx_skill_q',
  w: 'sfx_skill_w',
  r: 'sfx_skill_r',
  turretDestroy: 'sfx_turret_destroy',
  bossAppear: 'sfx_boss_appear',
  victory: 'sfx_victory',
};

export type MusicMode = 'none' | 'title' | 'field' | 'boss' | 'victory';
/** 모드별 배경음악 키 (assets.json audio 항목). 앞의 키가 비어 있으면 다음 키 사용 */
const MUSIC_KEYS: Record<Exclude<MusicMode, 'none'>, string[]> = {
  title: ['bgm_title'],
  field: ['bgm'],
  boss: ['bgm_boss', 'bgm'],
  victory: ['bgm_victory', 'bgm_title'],
};
const BGM_VOL = 0.55;

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private files = new Map<string, AudioBuffer | null>();
  private musicTimer: number | null = null;
  private musicMode: MusicMode = 'none';
  private musicStep = 0;
  private nextNoteTime = 0;
  private bgmEl: HTMLAudioElement | null = null;
  /** 배경음악 요소 풀 (url → 요소). iOS 에서는 사용자 입력 중 한 번 재생된 요소만 이후 자동 재생 가능 */
  private bgmPool = new Map<string, HTMLAudioElement>();
  private fadeTimer: number | null = null;
  private voiceUntil = 0;
  private voicePri = 0;
  private lastPlay = new Map<string, number>();

  get bgmOn() {
    return save.data.sound.bgm;
  }
  get sfxOn() {
    return save.data.sound.sfx;
  }

  /** 사용자 입력 핸들러 안에서 호출해야 함 */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = this.sfxOn ? 0.7 : 0;
        this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.bgmOn ? 0.32 : 0;
        this.musicBus.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.preloadFiles();
      }
      this.primeBgm();
      this.resumeMusic();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      // iOS 무음 버퍼 재생으로 오디오 잠금 해제
      const b = this.ctx.createBuffer(1, 1, 22050);
      const s = this.ctx.createBufferSource();
      s.buffer = b;
      s.connect(this.ctx.destination);
      s.start(0);
    } catch (e) {
      console.warn('[audio] 사용 불가 — 무음으로 진행합니다', e);
      this.ctx = null;
    }
  }

  private preloadFiles() {
    const audio = runtime.assets.audio || {};
    for (const key of Object.keys(audio)) {
      const url = audio[key];
      if (!url || key.startsWith('bgm') || key.startsWith('_')) continue;
      fetch(ver(url))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((buf) => this.ctx!.decodeAudioData(buf))
        .then((ab) => this.files.set(key, ab))
        .catch(() => this.files.set(key, null));
    }
  }

  private bgmUrl(mode: MusicMode) {
    if (mode === 'none') return '';
    for (const k of MUSIC_KEYS[mode]) {
      const u = runtime.assets.audio?.[k];
      if (u) return u;
    }
    return '';
  }

  private bgmElement(url: string) {
    let el = this.bgmPool.get(url);
    if (!el) {
      el = new Audio();
      el.preload = 'none';
      el.loop = true;
      el.src = ver(url);
      el.setAttribute('playsinline', '');
      this.bgmPool.set(url, el);
    }
    return el;
  }

  /** 사용자 입력 안에서 모든 배경음악 요소를 무음으로 한 번 재생 → iOS 자동재생 제한 해제 */
  private primed = false;
  private primeBgm() {
    if (this.primed) return;
    this.primed = true;
    const urls = new Set((['title', 'field', 'boss', 'victory'] as MusicMode[]).map((m) => this.bgmUrl(m)).filter(Boolean));
    for (const url of urls) {
      const el = this.bgmElement(url);
      if (el === this.bgmEl) continue;
      el.muted = true;
      const r = el.play();
      if (r && r.then) r.then(() => { if (el !== this.bgmEl) el.pause(); el.muted = !this.bgmOn; }).catch(() => {});
    }
  }

  setBgm(on: boolean) {
    save.update((d) => (d.sound.bgm = on));
    if (this.musicBus) this.musicBus.gain.value = on ? 0.32 : 0;
    if (this.bgmEl) {
      this.bgmEl.muted = !on;
      if (on && this.bgmEl.paused) this.bgmEl.play().catch(() => {});
    }
  }
  setSfx(on: boolean) {
    save.update((d) => (d.sound.sfx = on));
    if (this.sfxBus) this.sfxBus.gain.value = on ? 0.7 : 0;
  }

  /** 파일 재생 성공 시 true */
  private limiter: DynamicsCompressorNode | null = null;
  private skillLimiter() {
    if (!this.limiter && this.ctx) {
      const c = this.ctx.createDynamicsCompressor();
      c.threshold.value = -3;
      c.knee.value = 2;
      c.ratio.value = 20;
      c.attack.value = 0.002;
      c.release.value = 0.18;
      c.connect(this.sfxBus);
      this.limiter = c;
    }
    return this.limiter || undefined;
  }

  private playFile(key: string, gain = 1, out?: AudioNode) {
    const buf = this.files.get(key);
    if (!buf || !this.ctx) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(out || this.sfxBus);
    src.start();
    return true;
  }

  /** 음성 파일이 등록되어 있으면 재생 (없으면 false → 텍스트 안내만) */
  voice(key: string) {
    return this.announce(key, 2);
  }

  /**
   * 아나운서 대사. 대사끼리 겹치지 않도록 재생 중이면 우선순위가 높을 때만 끼어든다.
   * priority: 1 일반(멀티킬 등) / 2 중요(포탑·억제기·사망) / 3 최우선(보스·승리)
   */
  announce(key: string, priority = 1) {
    if (!this.ctx || !this.sfxOn) return false;
    const buf = this.files.get(key);
    if (!buf) return false;
    const now = performance.now();
    if (now < this.voiceUntil && priority <= this.voicePri) return false;
    this.playFile(key, 1.15);
    this.voiceUntil = now + buf.duration * 1000;
    this.voicePri = priority;
    // 대사 중 배경음악 줄이기 (iOS 는 음량 조절이 안 되므로 영향 없음)
    const el = this.bgmEl;
    if (el) {
      el.volume = BGM_VOL * 0.45;
      window.setTimeout(() => { if (this.bgmEl === el && performance.now() >= this.voiceUntil - 50) el.volume = BGM_VOL; }, buf.duration * 1000 + 80);
    }
    return true;
  }

  play(name: Sfx) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    // 같은 소리 과다 중첩 방지
    const now = performance.now();
    const minGap = name === 'hit' || name === 'turretShot' || name === 'attack' ? 70 : 30;
    if (now - (this.lastPlay.get(name) || 0) < minGap) return;
    this.lastPlay.set(name, now);
    const fk = FILE_KEY[name];
    // 스킬 효과음 파일은 증폭 후 리미터로 피크만 눌러 크게 재생
    const boost = SKILL_FILE_GAIN[name];
    if (fk && this.playFile(fk, boost ?? 1, boost ? this.skillLimiter() : undefined)) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'attack':
        this.tone('triangle', 880, 1320, 0.09, 0.18, t);
        this.tone('sine', 1760, 1200, 0.06, 0.08, t);
        break;
      case 'hit':
        this.noise(0.06, 0.12, 2400, t);
        break;
      case 'q':
        this.noise(0.28, 0.25, 1200, t, 5000);
        this.tone('sawtooth', 300, 900, 0.22, 0.12, t);
        this.tone('sine', 1200, 600, 0.25, 0.12, t + 0.03);
        break;
      case 'w':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f, f, 0.35, 0.1, t + i * 0.05));
        break;
      case 'r':
        [262, 330, 392, 523].forEach((f) => this.tone('sawtooth', f, f, 0.9, 0.06, t));
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.16, 0.06, t + 0.1 + i * 0.07));
        this.noise(0.6, 0.15, 600, t);
        break;
      case 'turretShot':
        this.tone('square', 520, 260, 0.08, 0.06, t);
        this.noise(0.05, 0.06, 3000, t);
        break;
      case 'explode':
        this.noise(0.35, 0.3, 500, t);
        this.tone('sine', 140, 40, 0.35, 0.3, t);
        break;
      case 'turretDestroy':
        this.noise(0.9, 0.4, 400, t);
        this.tone('sine', 120, 30, 0.9, 0.4, t);
        [392, 523, 659].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.1, t + 0.35 + i * 0.09));
        break;
      case 'levelup':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.12, t + i * 0.07));
        break;
      case 'bossAppear':
        this.tone('sawtooth', 90, 45, 1.6, 0.25, t);
        this.tone('sawtooth', 95, 47, 1.6, 0.2, t);
        for (let i = 0; i < 8; i++) this.tone('square', 200 + Math.random() * 1600, 100, 0.05, 0.05, t + 0.2 + i * 0.09);
        break;
      case 'bossShot':
        this.tone('sawtooth', 700, 200, 0.2, 0.08, t);
        break;
      case 'bossAoe':
        this.noise(0.5, 0.35, 300, t);
        this.tone('sine', 90, 30, 0.5, 0.35, t);
        break;
      case 'warn':
        this.tone('square', 880, 880, 0.08, 0.05, t);
        this.tone('square', 660, 660, 0.08, 0.05, t + 0.1);
        break;
      case 'lock':
        this.tone('square', 220, 160, 0.15, 0.08, t);
        this.noise(0.05, 0.08, 4000, t + 0.1);
        break;
      case 'victory':
        [523, 659, 784].forEach((f) => this.tone('triangle', f, f, 0.5, 0.1, t));
        [587, 740, 880].forEach((f) => this.tone('triangle', f, f, 0.5, 0.1, t + 0.45));
        [659, 830, 988, 1319].forEach((f) => this.tone('triangle', f, f, 1.4, 0.1, t + 0.9));
        break;
      case 'memory':
        [1047, 1319, 1568, 2093].forEach((f, i) => this.tone('sine', f, f, 0.5, 0.08, t + i * 0.09));
        break;
      case 'click':
        this.tone('sine', 900, 1200, 0.05, 0.08, t);
        break;
      case 'welcome':
      case 'summon':
        [392, 523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.6, 0.08, t + i * 0.12));
        this.tone('sine', 196, 196, 1.2, 0.1, t);
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, t: number, bus?: GainNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, t: number, freqEnd?: number, bus?: GainNode) {
    const ctx = this.ctx!;
    if (!this.noiseBuf) return;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus || this.sfxBus);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  /* ───────── 배경음악 ───────── */
  music(mode: MusicMode) {
    if (mode === this.musicMode) return;
    this.musicMode = mode;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const url = this.bgmUrl(mode);
    const prev = this.bgmEl;
    // 같은 곡이면 끊지 않고 이어서 재생 (예: 필드 → 보스전에서 보스 곡이 없을 때)
    if (prev && url && prev === this.bgmPool.get(url)) return;
    if (prev) {
      this.bgmEl = null;
      this.fadeOut(prev);
    }
    if (mode === 'none') return;
    if (url) {
      const el = this.bgmElement(url);
      el.muted = !this.bgmOn;
      el.volume = BGM_VOL;
      try {
        el.currentTime = 0;
      } catch {
        /* 메타데이터 로딩 전 */
      }
      el.onerror = () => {
        if (this.bgmEl === el) {
          this.bgmEl = null;
          this.startSynthMusic();
        }
      };
      this.bgmEl = el;
      el.play().catch(() => {
        /* 자동재생 차단: 다음 사용자 입력(unlock)에서 다시 시도 */
      });
      return;
    }
    if (this.ctx) this.startSynthMusic();
  }

  /** 배경음악이 브라우저 자동재생 제한으로 대기 중인지 */
  get musicBlocked() {
    const el = this.bgmEl;
    return !!el && el.paused && this.bgmOn;
  }
  get currentBgm() {
    return this.bgmEl;
  }

  /** 사용자 입력 후 재생이 막혀 있던 배경음악 재시도 */
  resumeMusic() {
    const el = this.bgmEl;
    if (el && el.paused && this.bgmOn) el.play().catch(() => {});
  }

  private fadeOut(el: HTMLAudioElement) {
    const start = el.volume;
    let k = 0;
    const id = window.setInterval(() => {
      k++;
      el.volume = Math.max(0, start * (1 - k / 8));
      if (k >= 8) {
        clearInterval(id);
        el.pause();
        el.volume = BGM_VOL;
      }
    }, 40);
  }

  private startSynthMusic() {
    if (!this.ctx) return;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  /** 간단한 오리지널 루프: 단조 진행 + 아르페지오 + 베이스 + 킥 */
  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const boss = this.musicMode === 'boss';
    const victory = this.musicMode === 'victory';
    const bpm = boss ? 138 : victory ? 96 : 104;
    const stepDur = 60 / bpm / 4; // 16분음표
    // Am - F - C - G (필드) / Dm - Bb - Gm - A (보스) / C - G - Am - F (승리)
    const prog = boss
      ? [[146.8, 174.6, 220], [116.5, 146.8, 174.6], [98, 116.5, 146.8], [110, 138.6, 164.8]]
      : victory
        ? [[130.8, 164.8, 196], [98, 123.5, 146.8], [110, 130.8, 164.8], [87.3, 110, 130.8]]
        : [[110, 130.8, 164.8], [87.3, 110, 130.8], [130.8, 164.8, 196], [98, 123.5, 146.8]];
    while (this.nextNoteTime < ctx.currentTime + 0.25) {
      const step = this.musicStep;
      const bar = Math.floor(step / 16) % 4;
      const chord = prog[bar];
      const t = this.nextNoteTime;
      const inBar = step % 16;
      // 베이스
      if (inBar % 4 === 0) this.tone(boss ? 'sawtooth' : 'triangle', chord[0] / 2, chord[0] / 2, stepDur * 3.5, boss ? 0.13 : 0.18, t, this.musicBus);
      // 아르페지오
      const arp = [0, 1, 2, 1, 2, 0, 1, 2];
      const note = chord[arp[inBar % 8]] * (inBar >= 8 ? 4 : 2);
      if (!victory || inBar % 2 === 0) this.tone(boss ? 'square' : 'triangle', note, note, stepDur * 0.9, boss ? 0.035 : 0.05, t, this.musicBus);
      // 패드
      if (inBar === 0) chord.forEach((f) => this.tone('sine', f * 2, f * 2, stepDur * 15, 0.035, t, this.musicBus));
      // 드럼
      if (inBar % 4 === 0) {
        this.tone('sine', 120, 40, 0.15, boss ? 0.32 : 0.22, t, this.musicBus);
      }
      if (inBar % 8 === 4) this.noise(0.12, boss ? 0.1 : 0.07, 3000, t, undefined, this.musicBus);
      if (boss && inBar % 2 === 1) this.noise(0.03, 0.04, 8000, t, undefined, this.musicBus);
      this.nextNoteTime += stepDur;
      this.musicStep++;
    }
  }
}

export const audio = new AudioEngine();
