import { bus } from '../core/events';
import { fsm, GameState } from '../core/state';
import { save } from '../core/save';
import { audio } from '../audio/audio';
import { runtime, VideoEntry } from '../config/runtime';
import { ICONS, championSvg, svgDataUrl } from '../art/svgs';
import { WORLD } from '../world/mapData';
import { CAPTAIN_DEFS } from '../config/captains';

/**
 * HTML 기반 UI: 타이틀, HUD, 튜토리얼, 일시정지, 기억 발견, 기록관, 영상, 승리 화면.
 * HUD 버튼은 캔버스 위 DOM 요소이므로 맵 이동 입력과 분리됩니다.
 */
export interface UiHooks {
  startGame(resume: boolean): void;
  restartGame(): void;
  quitToTitle(): void;
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const h = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

let hooks: UiHooks;
let root: HTMLElement;
const timers = new Set<number>();
function later(fn: () => void, ms: number) {
  const id = window.setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
  return id;
}

/**
 * 게임 이미지의 절대 URL.
 * CSS 사용자 정의 속성(--img 등)에 상대 경로를 넣으면 var() 가 쓰이는 스타일시트(assets/*.css)
 * 기준으로 해석되어 /assets/assets/... 로 깨지므로, 문서 기준(document.baseURI)으로 미리 절대화합니다.
 * 루트 배포(https://x/)와 하위 경로 배포(https://x/sindoh/) 모두 동작합니다.
 */
export const assetUrl = (path: string) => new URL(path, document.baseURI).href;
const G = (k: string) => assetUrl(`assets/game/${k}.webp`);
/** 일러스트 이미지 + 로딩 실패 시 내장 SVG 대체 */
function artImg(src: string, fallbackPose: 'idle' | 'victory', cls = '', alt = '') {
  const fb = svgDataUrl(championSvg(fallbackPose));
  return `<img class="${cls}" alt="${alt}" src="${src}" onerror="this.onerror=null;this.src='${fb}'">`;
}
function championImg(pose: 'idle' | 'victory' = 'idle') {
  const override = runtime.assets.images?.[pose === 'idle' ? 'title_champ' : 'champ_victory'];
  return override || G(pose === 'idle' ? 'title_champ' : 'champ_victory');
}

/* ═════════════ 초기화 ═════════════ */
export function initUi(h0: UiHooks) {
  hooks = h0;
  root = document.getElementById('ui')!;
  // 페이지 스크롤/줌 방지
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener(
    'touchmove',
    (e) => {
      const el = e.target as HTMLElement;
      // 아이폰 '위로 밀기' 안내 중에는 문서 스크롤을 허용해 주소창이 접히게 함
      if (!el.closest('.panel') && !el.closest('video') && !el.closest('#swipeGuard')) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // 선물 버전: NFC 주소의 입장 코드를 곧바로 처리 (주소창에서 코드 제거)
  if (__EDITION__ === 'private') import('./privateVideo').then((pv) => pv.initPrivateAuth());
  buildTitle();
  buildHud();
  buildRotateGuard();
  buildIosFullscreen();
  bus.on('loading', (v: number) => {
    const bar = $('#title .loading-bar i');
    if (bar) bar.style.width = Math.round(v * 100) + '%';
  });
  bus.on('boot:ready', () => {
    const s = $<HTMLButtonElement>('#startBtn');
    if (s) {
      s.disabled = false;
      s.lastChild!.textContent = save.hasProgress() ? '처음부터 입장' : '협곡 입장';
    }
    $('#title .loading-bar')?.classList.add('hidden');
    $('#title')?.classList.add('ready');
    $('#continueBtn')?.classList.toggle('hidden', !save.hasProgress());
    $('#continueBtn2')?.classList.toggle('hidden', !save.hasProgress());
  });
  bus.on('state', ({ next }) => onState(next));
  bus.on('hud', updateHud);
  bus.on('banner', showBanner);
  bus.on('toast', showToast);
  bus.on('memory:found', showMemoryFound);
  bus.on('victory', showVictory);
  bus.on('ult', showUltOverlay);
  bus.on('boss:intro', showBossIntro);
  bus.on('boss:start', () => $('#bossBar').classList.remove('hidden'));
  bus.on('boss:end', () => $('#bossBar').classList.add('hidden'));
  bus.on('hint:ult', () => {
    const r = $('#skill-r');
    r.classList.add('hint');
    later(() => r.classList.remove('hint'), 6000);
  });
  bus.on('player:hit', () => {
    const v = $('#vignette');
    v.classList.add('hit');
    later(() => v.classList.remove('hit'), 160);
  });
  bus.on('player:dead', () => $('#respawn').classList.remove('hidden'));
  bus.on('player:respawn', () => $('#respawn').classList.add('hidden'));
  bus.on('ui:pause', () => {
    if (fsm.isRunning) openPause();
    else if (fsm.state === GameState.PAUSED) closeOverlay();
  });
  bus.on('minimap:bg', (cv: HTMLCanvasElement) => (miniBg = cv));
  bus.on('minimap:source', (fn: any) => (miniSource = fn));
  bus.on('tut:moved', () => tutSignal('move'));
  bus.on('tut:attacked', () => tutSignal('attack'));
  bus.on('tut:skill', () => tutSignal('skill'));
  // 탭 전환 시 자동 일시정지
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && fsm.isRunning) openPause();
  });
  onState(GameState.TITLE);
  // 타이틀 배경음악: 브라우저 자동재생 제한으로 첫 터치·클릭 때 시작
  const titleMusic = () => {
    audio.unlock();
    if (fsm.baseState === GameState.TITLE && fsm.state !== GameState.VIDEO) audio.music('title');
  };
  document.addEventListener('pointerdown', titleMusic, { capture: true });
  document.addEventListener('keydown', titleMusic, { capture: true, once: true });
}

/* ═════════════ 상태 → 화면 ═════════════ */
function onState(next: GameState) {
  const running = fsm.isRunning;
  $('#title').classList.toggle('hidden', next !== GameState.TITLE && !(next === GameState.ARCHIVE && fsm.baseState === GameState.TITLE) && !(next === GameState.VIDEO && fsm.baseState === GameState.TITLE));
  const inGame = running || next === GameState.PAUSED || ((next === GameState.ARCHIVE || next === GameState.VIDEO) && fsm.baseState !== GameState.TITLE && fsm.baseState !== GameState.VICTORY);
  $('#hud').classList.toggle('hidden', !inGame);
  if (next === GameState.BOSS_BATTLE || next === GameState.NEXUS_BATTLE || next === GameState.PLAYING) $('#tutorial')?.classList.add('hidden');
}

/* ═════════════ 가로 화면 전용 ═════════════ */
/** 세로로 들고 있는 휴대폰에서는 안내 화면을 덮고, 게임 중이면 자동 일시정지 */
const PORTRAIT_MQ = '(orientation: portrait) and (max-width: 900px)';
function buildRotateGuard() {
  root.appendChild(
    h(`<div id="rotateGuard" class="rotate-guard">
      <div class="rg-phone"><i></i></div>
      <b>휴대폰을 가로로 돌려 주세요</b>
      <small>SINDOH LEGENDS는 가로 화면에서 플레이합니다.</small>
    </div>`),
  );
  const mq = window.matchMedia(PORTRAIT_MQ);
  const onChange = () => {
    if (mq.matches && fsm.isRunning) openPause();
  };
  mq.addEventListener?.('change', onChange);
  window.addEventListener('orientationchange', () => setTimeout(onChange, 300));
}

/**
 * 아이폰 사파리: 웹페이지가 전체화면 API 를 쓸 수 없으므로
 * ① 가로 화면에서 주소창이 보이면 '위로 밀어 올리기' 안내 → 문서를 스크롤하면 사파리가 주소창을 접음
 * ② 홈 화면에 추가하면 주소창 없이 앱처럼 실행 (안내 문구 제공)
 */
const IS_IOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_STANDALONE = (navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;
function buildIosFullscreen() {
  if (!IS_IOS || IS_STANDALONE) return;
  document.documentElement.classList.add('ios-swipe');
  const el = h(`<div id="swipeGuard" class="swipe-guard hidden">
      <div class="sg-hand"><i></i></div>
      <b>화면을 위로 밀어 올려 주세요</b>
      <small>주소창이 사라지고 전체 화면으로 플레이할 수 있습니다.<br>
      공유 버튼 → <em>홈 화면에 추가</em>로 설치하면 처음부터 주소창 없이 실행됩니다.</small>
      <button class="btn ghost" type="button" data-a="skip">이대로 계속하기</button>
    </div>`);
  root.appendChild(el);
  // '이대로 계속하기'는 이번 접속(탭) 동안 유지
  let skipped = false;
  try {
    skipped = sessionStorage.getItem('sl_swipe_skip') === '1';
  } catch {
    /* 저장소 차단 */
  }
  ($('[data-a=skip]', el) as HTMLElement).onclick = (e) => {
    e.stopPropagation();
    skipped = true;
    try {
      sessionStorage.setItem('sl_swipe_skip', '1');
    } catch {
      /* 저장소 차단 */
    }
    el.classList.add('hidden');
  };
  let maxLandscapeH = 0;
  const check = () => {
    const landscape = window.innerWidth > window.innerHeight;
    if (landscape) maxLandscapeH = Math.max(maxLandscapeH, window.innerHeight);
    // 가로일 때 전체 높이 = 화면의 짧은 변 (또는 지금까지 관찰한 가장 큰 가로 높이)
    const full = Math.max(Math.min(screen.width, screen.height), maxLandscapeH);
    const chromeVisible = landscape && window.innerHeight < full - 24;
    el.classList.toggle('hidden', skipped || !chromeVisible);
  };
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', () => setTimeout(check, 400));
  window.visualViewport?.addEventListener('resize', check);
  check();
}

/** 시작 버튼(사용자 입력) 안에서 호출: 안드로이드 크롬은 전체화면 + 가로 고정, 미지원 기기는 그대로 진행 */
function requestLandscape() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (!coarse) return;
  const el = document.documentElement as any;
  const lock = () => (screen.orientation as any)?.lock?.('landscape').catch(() => {});
  try {
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req && !document.fullscreenElement) {
      const r = req.call(el, { navigationUI: 'hide' });
      if (r && typeof r.then === 'function') r.then(lock).catch(() => {});
      else lock();
    } else lock();
  } catch {
    /* iOS Safari 등: 전체화면·방향 고정 미지원 → 안내 화면으로 대응 */
  }
}

/* ═════════════ 타이틀 ═════════════ */
function buildTitle() {
  const name = runtime.assets.champion.name;
  const el = h(`
  <div id="title" class="screen">
    <!-- 세로 화면: 레이어 구성 -->
    <div class="tp">
      <div class="clouds"></div>
      <div class="title-top">
        <span class="tag">${runtime.assets.champion.affiliation} · ${esc(runtime.titleTag)}</span>
        <button class="img-btn" id="titleSound" aria-label="소리 켜기/끄기"><img src="${G('ui_sound')}" alt=""><i class="mute"></i></button>
      </div>
      <img class="logo-img" src="${G('title_logo')}" alt="SINDOH LEGENDS - THE LAST SUMMONER"
        onerror="this.outerHTML='<div class=&quot;logo&quot;><div class=&quot;l1&quot;>SINDOH<span>LEGENDS</span></div><div class=&quot;l2&quot;>THE LAST SUMMONER</div></div>'">
      <div class="hero">
        <img class="nexus" src="${G('s_ally_nexus')}" alt="" onerror="this.remove()">
        ${artImg(championImg('idle'), 'idle', 'champ', name)}
        <img class="minions" src="${G('title_minions')}" alt="" onerror="this.remove()">
      </div>
      <div class="title-actions">
        <div class="loading-bar"><i></i></div>
        <button class="pill-btn gold hidden" id="continueBtn">이어하기</button>
        <button class="pill-btn" id="startBtn" disabled><span>불러오는 중…</span></button>
        <button class="pill-btn small" id="archiveBtn">${ICONS.archive}<span>추억의 기록관</span></button>
        <div class="credit">${esc(runtime.credit)}</div>
      </div>
    </div>
    <!-- 가로 화면: 시작 화면 일러스트 + 터치 영역 -->
    <div class="tl">
      <div class="tl-bg"></div>
      <div class="tl-art">
        <img src="${G('title_full')}" alt="SINDOH LEGENDS 시작 화면" draggable="false">
        <button class="hot hidden" data-act="continue" id="continueBtn2" style="left:31%;top:42.5%;width:40%;height:11%">이어하기</button>
        <button class="hot invisible" data-act="start" style="left:31%;top:56%;width:40%;height:14%" aria-label="협곡 입장"></button>
        <button class="hot invisible" data-act="archive" style="left:23%;top:78.5%;width:30.5%;height:13.5%" aria-label="추억의 기록관"></button>
        <button class="hot invisible" data-act="sound" style="left:55.4%;top:78.5%;width:8.6%;height:13.5%" aria-label="소리"><i class="mute"></i></button>
        <button class="hot invisible" data-act="settings" style="left:66.2%;top:78.5%;width:8.6%;height:13.5%" aria-label="설정"></button>
        <div class="tl-loading">불러오는 중…</div>
      </div>
    </div>
  </div>`);
  root.appendChild(el);
  const soundBtn = $('#titleSound');
  const paintSound = () => el.classList.toggle('muted', !(save.data.sound.bgm || save.data.sound.sfx));
  paintSound();
  const toggleSound = () => {
    const on = !(save.data.sound.bgm || save.data.sound.sfx);
    audio.setBgm(on);
    audio.setSfx(on);
    paintSound();
  };
  soundBtn.onclick = toggleSound;
  el.querySelectorAll<HTMLElement>('.tl .hot').forEach((b) =>
    (b.onclick = () => {
      if (!el.classList.contains('ready') && b.dataset.act !== 'sound' && b.dataset.act !== 'settings') return;
      const act = b.dataset.act;
      if (act === 'start') $<HTMLButtonElement>('#startBtn').click();
      else if (act === 'continue') $<HTMLButtonElement>('#continueBtn').click();
      else if (act === 'archive') $<HTMLButtonElement>('#archiveBtn').click();
      else if (act === 'sound') toggleSound();
      else if (act === 'settings') openSettings();
    }),
  );
  $('#startBtn').onclick = () => {
    requestLandscape();
    audio.unlock();
    audio.play('click');
    playIntro(false);
  };
  $('#continueBtn').onclick = () => {
    requestLandscape();
    audio.unlock();
    audio.play('click');
    playIntro(true);
  };
  $('#archiveBtn').onclick = () => {
    audio.unlock();
    openArchive();
  };
}

function playIntro(resume: boolean) {
  if (fsm.state !== GameState.TITLE) return;
  fsm.set(GameState.INTRO);
  const el = h(`<div id="intro" class="screen" style="--map:url('${G('intro_map')}')">
    <div class="msg" id="im1">신도의 협곡에 오신 것을 환영합니다.</div>
    <div class="msg gold" id="im2">${runtime.assets.champion.name} 소환 완료</div>
  </div>`);
  root.appendChild(el);
  later(() => {
    $('#im1').classList.add('on');
    if (!audio.voice('vo_welcome')) audio.play('welcome');
  }, 300);
  later(() => {
    hooks.startGame(resume);
  }, 1500);
  later(() => {
    $('#im2').classList.add('on');
    audio.play('summon');
  }, 2300);
  later(() => el.classList.add('fade'), 3600);
  later(() => {
    el.remove();
    audio.music('field');
    later(() => audio.announce('vo_minions', 1), 1200);
    if (!save.data.tutorialDone) startTutorial();
    else {
      fsm.set(GameState.PLAYING);
      showToast('원하는 라인으로 이동해 팀과 합류하세요. TOP 추진팀 · MID 개발팀 · BOT 사업팀');
    }
  }, 4200);
}

/* ═════════════ 튜토리얼 ═════════════ */
const TUT = [
  { key: 'move', icon: '👆', title: '화면을 터치해 이동', desc: '원하는 곳을 터치하거나 누른 채로 끌면 GAME MASTER가 이동합니다.' },
  { key: 'attack', icon: '🎯', title: '적을 터치하면 자동 공격', desc: '가까운 적은 멈춰 있을 때 자동으로 공격합니다.' },
  { key: 'skill', icon: '⚡', title: '스킬 버튼으로 능력 사용', desc: 'Q 긴급 대응 · W 보안 강화 · R 전 부서 집결' },
  { key: 'tower', icon: '🏰', title: '미니언과 함께 포탑 공격', desc: '포탑은 미니언을 먼저 노립니다. 아군과 함께 진격하세요!' },
];
let tutStep = -1;
let tutTimer = 0;
function startTutorial() {
  fsm.set(GameState.TUTORIAL);
  tutStep = -1;
  const el = h(`<div id="tutorial" class="tutorial">
    <div class="ti"></div><div class="tx"><b></b><small></small><div class="dots">${TUT.map(() => '<i></i>').join('')}</div></div>
    <button class="skip" id="tutSkip">건너뛰기</button></div>`);
  $('#hud').appendChild(el);
  $('#tutSkip').onclick = endTutorial;
  nextTut();
}
function nextTut() {
  tutStep++;
  if (tutStep >= TUT.length) return endTutorial();
  const s = TUT[tutStep];
  const el = $('#tutorial');
  if (!el) return;
  $('.ti', el).textContent = s.icon;
  $('b', el).textContent = s.title;
  $('small', el).textContent = s.desc;
  el.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i <= tutStep));
  clearTimeout(tutTimer);
  tutTimer = later(nextTut, s.key === 'tower' ? 5000 : 7000);
}
function tutSignal(key: string) {
  if (fsm.state !== GameState.TUTORIAL || tutStep < 0) return;
  if (TUT[tutStep]?.key === key) {
    clearTimeout(tutTimer);
    tutTimer = later(nextTut, 900);
  }
}
function endTutorial() {
  clearTimeout(tutTimer);
  $('#tutorial')?.remove();
  tutStep = -1;
  save.update((d) => (d.tutorialDone = true));
  if (fsm.state === GameState.TUTORIAL) fsm.set(GameState.PLAYING);
  showToast('원하는 라인을 골라 진격하세요! 한 라인만 돌파해도 적 본진에 들어갈 수 있습니다.');
}

/* ═════════════ HUD ═════════════ */
let miniBg: HTMLCanvasElement | null = null;
let miniSource: (() => any) | null = null;
let miniTimer = 0;

function buildHud() {
  const el = h(`
  <div id="hud" class="hidden">
    <div class="vignette passthru" id="vignette"></div>
    <!-- 좌측 상단: 미니맵 + 플레이어 정보·목표·패시브 -->
    <div class="hud-tl">
      <div class="minimap-wrap"><canvas id="minimap" width="256" height="256"></canvas></div>
      <div class="hud-info">
        <div class="player-card passthru">
          <div class="portrait"><img src="${G('ui_portrait')}" alt="" onerror="this.onerror=null;this.src='${svgDataUrl(championSvg('idle'))}'"><span class="lv" id="lvl">1</span></div>
          <div class="bars">
            <div class="nm">${runtime.assets.champion.name}<b id="hpText"></b></div>
            <div class="bar hp" id="hpBar"><i></i></div>
            <div class="bar xp" id="xpBar"><i></i></div>
          </div>
        </div>
        <div class="objective passthru" id="objective"></div>
        <div class="buffs passthru" id="buffs"></div>
      </div>
    </div>
    <!-- 우측 상단: 일시정지 -->
    <button class="img-btn" id="pauseBtn" aria-label="일시정지"><img src="${G('ui_pause')}" alt=""></button>
    <div class="boss-bar passthru hidden" id="bossBar">
      <div class="bn">ZERO DAY</div>
      <div class="bar"><i></i><div class="floor"></div></div>
      <div class="lockmsg hidden" id="bossLock">취약점 방어막 — 궁극기로 돌파하세요!</div>
    </div>
    <div class="toast passthru" id="toast"></div>
    <div class="banner passthru" id="banner"><div class="bt"></div><div class="bs"></div></div>
    <img class="obj-arrow passthru hidden" id="objArrow" src="${arrowSvg()}" alt="">
    <div class="ult-overlay passthru hidden" id="ultOverlay">
      <div class="team" style="color:#7fb3ff">추진팀!</div>
      <div class="team" style="color:#7fe0ff">개발팀!</div>
      <div class="team" style="color:#5cffb8">사업팀!</div>
      <div class="final">전 부서 집결!</div>
    </div>
    <div class="boss-intro passthru hidden" id="bossIntro"><div><div class="bi">ZERO DAY</div><div class="bs">보안 취약점의 화신</div></div></div>
    <!-- 우측 하단: 스킬 (R 을 모서리 큰 버튼으로, Q·W 를 호 모양으로 배치) -->
    <div class="skills">
        <button class="skill w" id="skill-w" aria-label="W 보안 강화" style="--img:url('${G('ui_w')}')"><span class="fallback">${ICONS.w}</span><span class="face"></span><div class="cd"></div><span class="cdt"></span><span class="key">W</span><span class="lab">보안 강화</span></button>
        <button class="skill q" id="skill-q" aria-label="Q 긴급 대응" style="--img:url('${G('ui_q')}')"><span class="fallback">${ICONS.q}</span><span class="face"></span><div class="cd"></div><span class="cdt"></span><span class="key">Q</span><span class="lab">긴급 대응</span></button>
        <button class="skill r" id="skill-r" aria-label="R 전 부서 집결!" style="--img:url('${G('ui_r')}')"><span class="fallback">${ICONS.r}</span><span class="face"></span><div class="cd"></div><span class="cdt"></span><span class="key">R</span><span class="lab">전 부서 집결!</span></button>
      </div>
    <div class="respawn passthru hidden" id="respawn"><div><div class="t1">GAME MASTER 본진 귀환 중</div><div class="t2" id="respawnT">4</div><div class="t3">레벨과 파괴한 포탑 기록은 그대로 유지됩니다</div></div></div>
  </div>`);
  root.appendChild(el);
  $('#pauseBtn').onclick = (e) => {
    e.stopPropagation();
    openPause();
  };
  for (const k of ['q', 'w', 'r'] as const) {
    const b = $('#skill-' + k);
    // pointerdown 즉시 발동 + 캔버스로 이벤트 전달 차단
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 누름 상태 표시 (터치에서는 :active 가 불안정하므로 클래스로 처리)
      b.classList.add('pressed');
      later(() => b.classList.remove('pressed'), 140);
      bus.emit('skill', k);
    });
    b.addEventListener('click', (e) => e.stopPropagation());
  }
  const mm = $<HTMLCanvasElement>('#minimap');
  const onMini = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = mm.getBoundingClientRect();
    bus.emit('minimap:tap', { x: ((e.clientX - r.left) / r.width) * WORLD.w, y: ((e.clientY - r.top) / r.height) * WORLD.h });
  };
  mm.addEventListener('pointerdown', onMini);
  requestAnimationFrame(drawMinimapLoop);
}

function arrowSvg() {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M36 20 L10 6 L15 20 L10 34 Z" fill="#ffe28a" stroke="#141826" stroke-width="3" stroke-linejoin="round"/></svg>`,
  );
}

let lastHud: any = {};
const BUFF_NAME: Record<string, string> = { push: CAPTAIN_DEFS.push.passiveName, dev: CAPTAIN_DEFS.dev.passiveName, biz: CAPTAIN_DEFS.biz.passiveName };
const capIcons: Record<string, HTMLImageElement> = {};
for (const t of ['push', 'dev', 'biz']) {
  const im = new Image();
  im.src = G('cap_' + t + '_icon');
  capIcons[t] = im;
}
const CAP_COLOR: Record<string, string> = { push: '#3d8bff', dev: '#00b7ff', biz: '#00dc84' };
function updateHud(d: any) {
  const hpR = Math.max(0, d.hp / d.maxHp);
  const hpBar = $('#hpBar');
  (hpBar.firstElementChild as HTMLElement).style.transform = `scaleX(${hpR})`;
  hpBar.classList.toggle('low', hpR < 0.3);
  hpBar.classList.toggle('shield', !!d.shield);
  $("#hpText").textContent = `${Math.max(0, Math.ceil(d.hp))} / ${d.maxHp}`;
  ($('#xpBar').firstElementChild as HTMLElement).style.transform = `scaleX(${Math.min(1, d.xp)})`;
  if (lastHud.level !== d.level) $('#lvl').textContent = String(d.level);
  if (lastHud.objective !== d.objective) $('#objective').textContent = d.objective;
  for (const k of ['q', 'w', 'r'] as const) {
    const [rem, tot] = d.cd[k];
    const b = $('#skill-' + k);
    (b.querySelector('.cd') as HTMLElement).style.setProperty('--p', String(Math.min(1, rem / tot)));
    (b.querySelector('.cdt') as HTMLElement).textContent = rem > 0 ? String(Math.ceil(rem)) : '';
    b.classList.toggle('cooling', rem > 0);
    if (k === 'r') b.classList.toggle('ready', rem <= 0);
  }
  const bb = $('#bossBar');
  if (d.boss) {
    (bb.querySelector('.bar > i') as HTMLElement).style.transform = `scaleX(${Math.max(0, d.boss.hp / d.boss.max)})`;
    (bb.querySelector('.floor') as HTMLElement).style.left = '18%';
    $('#bossLock').classList.toggle('hidden', !d.boss.locked);
  }
  const ar = $('#objArrow');
  if (d.arrow && d.respawn === null) {
    const w = window.innerWidth,
      hh = window.innerHeight;
    const cx = w / 2,
      cy = hh / 2;
    const ang = Math.atan2(d.arrow.y - cy, d.arrow.x - cx);
    const mx = w / 2 - 34,
      my = hh / 2 - 120;
    const k = Math.min(Math.abs(mx / Math.cos(ang)), Math.abs(my / Math.sin(ang)));
    ar.style.left = cx + Math.cos(ang) * k + 'px';
    ar.style.top = cy + Math.sin(ang) * k + 'px';
    ar.style.transform = `rotate(${ang}rad)`;
    ar.classList.remove('hidden');
  } else ar.classList.add('hidden');
  if (d.respawn !== null) $('#respawnT').textContent = String(Math.ceil(d.respawn));
  const bk = (d.buffs || []).join(',');
  if (bk !== (lastHud.buffs || []).join(',')) {
    $('#buffs').innerHTML = (d.buffs || [])
      .map((t: string) => `<span class="buff"><img src="${G('cap_' + t + '_emblem')}" alt="">${BUFF_NAME[t] || ''}</span>`)
      .join('');
  }
  lastHud = d;
}

function drawMinimapLoop(t: number) {
  requestAnimationFrame(drawMinimapLoop);
  if (t - miniTimer < 180) return;
  miniTimer = t;
  const hud = $('#hud');
  if (!miniSource || hud.classList.contains('hidden')) return;
  const cv = $<HTMLCanvasElement>('#minimap');
  const c = cv.getContext('2d')!;
  const S = cv.width / WORLD.w;
  c.clearRect(0, 0, cv.width, cv.height);
  if (miniBg) c.drawImage(miniBg, 0, 0, cv.width, cv.height);
  else {
    c.fillStyle = '#0b2016';
    c.fillRect(0, 0, cv.width, cv.height);
  }
  const d = miniSource();
  if (!d) return;
  // 라인 팀 표시
  c.font = "600 15px Freesentation, 'Noto Sans KR', sans-serif";
  c.textAlign = 'center';
  for (const l of d.lanes) {
    const x = l.front.x * S,
      y = l.front.y * S;
    c.fillStyle = l.active ? 'rgba(0,220,132,0.35)' : 'rgba(255,255,255,0.15)';
    c.beginPath();
    c.arc(x, y, 12, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.strokeStyle = '#000a14';
    c.lineWidth = 4;
    c.strokeText(l.team, x, y - 14);
    c.fillText(l.team, x, y - 14);
  }
  for (const s of d.structures) {
    if (s.kind === 'allyNexus' || s.kind === 'nexus') {
      c.fillStyle = s.side === 'ally' ? '#00b7ff' : s.alive ? '#b06bff' : '#444';
      c.fillRect(s.x * S - 9, s.y * S - 9, 18, 18);
      continue;
    }
    c.fillStyle = !s.alive ? '#3a3a44' : s.side === 'ally' ? '#4f8cff' : '#ff3b5c';
    c.strokeStyle = '#000';
    c.lineWidth = 2;
    c.beginPath();
    c.rect(s.x * S - 6, s.y * S - 6, 12, 12);
    c.fill();
    c.stroke();
  }
  for (const m of d.memories) {
    c.fillStyle = '#ffe28a';
    c.beginPath();
    c.arc(m.x * S, m.y * S, 5, 0, Math.PI * 2);
    c.fill();
  }
  for (const u of d.units) {
    c.fillStyle = u.boss ? '#ff2fd0' : u.side === 'ally' ? '#7fd0ff' : '#ff6b8a';
    c.beginPath();
    c.arc(u.x * S, u.y * S, u.boss ? 9 : 3.5, 0, Math.PI * 2);
    c.fill();
  }
  // 팀장 NPC 위치 (쓰러져 부활 대기 중이면 회색 + 본진 위치)
  for (const cap of d.captains || []) {
    const x = cap.x * S,
      y = cap.y * S,
      r = 13;
    {
      const ctx = c;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = cap.dead ? '#3a3f4a' : CAP_COLOR[cap.team];
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r - 2, 0, Math.PI * 2);
      ctx.clip();
      const im = capIcons[cap.team];
      if (im.complete && im.naturalWidth) {
        if (cap.dead) ctx.filter = 'grayscale(1) brightness(.6)';
        ctx.drawImage(im, x - r + 2, y - r + 2, (r - 2) * 2, (r - 2) * 2);
        ctx.filter = 'none';
      }
      ctx.restore();
      if (cap.dead) {
        ctx.fillStyle = '#fff';
        ctx.font = '700 13px Freesentation, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(Math.ceil(cap.respawn)), x, y + 5);
      }
    }
  }
  if (d.player) {
    c.fillStyle = '#ffe28a';
    c.strokeStyle = '#000';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(d.player.x * S, d.player.y * S, 9, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

let toastTimer = 0;
function showToast(text: string) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = later(() => t.classList.remove('on'), 3600);
}

function showBanner(b: { text: string; sub?: string; kind?: string }) {
  const el = $('#banner');
  el.className = 'banner passthru ' + (b.kind || '');
  $('.bt', el).textContent = b.text;
  $('.bs', el).textContent = b.sub || '';
  void el.offsetWidth;
  el.classList.add('on');
}

function showUltOverlay(p?: { lines?: string[] }) {
  const el = $('#ultOverlay');
  el.classList.remove('hidden');
  const items = [...el.children] as HTMLElement[];
  // 팀장 설정(captains.ts)의 문구: 추진팀 지원 도착! / 개발팀 지원 도착! / 사업팀 지원 도착!
  if (p?.lines) p.lines.forEach((t, i) => items[i] && (items[i].textContent = t));
  items.forEach((c) => c.classList.remove('on'));
  void el.offsetWidth;
  items.forEach((c, i) => later(() => c.classList.add('on'), i < 3 ? 350 + i * 400 : 1600));
  later(() => el.classList.add('hidden'), 3600);
}

function showBossIntro() {
  const el = $('#bossIntro');
  el.classList.remove('hidden');
  const inner = el.firstElementChild as HTMLElement;
  const clone = inner.cloneNode(true);
  el.replaceChild(clone, inner);
  later(() => el.classList.add('hidden'), 2300);
}

/* ═════════════ 설정(타이틀) ═════════════ */
function openSettings() {
  const el = openModal(
    'settingsModal',
    `<h2>설정</h2><p class="sub">소리를 켜거나 끌 수 있습니다.</p>
    <div class="stack">
      <div class="toggle-row">
        <button class="btn ${save.data.sound.bgm ? '' : 'off'}" data-a="bgm">배경음악</button>
        <button class="btn ${save.data.sound.sfx ? '' : 'off'}" data-a="sfx">효과음</button>
      </div>
      <button class="btn primary" data-a="close">닫기</button>
    </div>`,
  );
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
    const a = b?.dataset.a;
    if (a === 'bgm') b!.classList.toggle('off', !(audio.setBgm(!save.data.sound.bgm), save.data.sound.bgm));
    else if (a === 'sfx') b!.classList.toggle('off', !(audio.setSfx(!save.data.sound.sfx), save.data.sound.sfx));
    else if (a === 'close' || e.target === el) el.remove();
    $('#title').classList.toggle('muted', !(save.data.sound.bgm || save.data.sound.sfx));
  };
}

/* ═════════════ 일시정지 ═════════════ */
function openModal(id: string, inner: string) {
  $('#' + id)?.remove();
  const el = h(`<div class="modal" id="${id}"><div class="panel">${inner}</div></div>`);
  root.appendChild(el);
  return el;
}

function openPause() {
  if (!fsm.isRunning) return;
  fsm.push(GameState.PAUSED);
  const el = openModal(
    'pauseModal',
    `<h2>일시정지</h2><p class="sub">게임이 멈췄습니다.</p>
    <div class="stack">
      <button class="btn primary" data-a="resume">계속하기</button>
      <button class="btn" data-a="archive">${ICONS.archive}<span>추억의 기록관</span></button>
      <div class="toggle-row">
        <button class="btn ${save.data.sound.bgm ? '' : 'off'}" data-a="bgm">배경음악</button>
        <button class="btn ${save.data.sound.sfx ? '' : 'off'}" data-a="sfx">효과음</button>
      </div>
      <button class="btn ghost" data-a="tutorial">조작 안내 다시 보기</button>
      <button class="btn ghost" data-a="restart">처음부터 다시</button>
      <button class="btn ghost" data-a="title">타이틀로</button>
    </div>`,
  );
  el.onclick = (e) => {
    const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
    if (!a) return;
    audio.play('click');
    if (a === 'resume') closeOverlay();
    else if (a === 'archive') openArchive();
    else if (a === 'bgm') {
      audio.setBgm(!save.data.sound.bgm);
      (e.target as HTMLElement).closest('button')!.classList.toggle('off', !save.data.sound.bgm);
    } else if (a === 'sfx') {
      audio.setSfx(!save.data.sound.sfx);
      (e.target as HTMLElement).closest('button')!.classList.toggle('off', !save.data.sound.sfx);
    } else if (a === 'tutorial') {
      closeOverlay();
      save.update((d) => (d.tutorialDone = false));
      $('#tutorial')?.remove();
      startTutorial();
    } else if (a === 'restart') {
      if (!confirm('진행 상황을 초기화하고 처음부터 다시 시작할까요?\n(해금한 기록은 유지됩니다)')) return;
      el.remove();
      fsm.pop();
      hooks.restartGame();
    } else if (a === 'title') {
      el.remove();
      fsm.pop();
      hooks.quitToTitle();
    }
  };
}

function closeOverlay() {
  $('#pauseModal')?.remove();
  $('#memoryModal')?.remove();
  fsm.pop();
}

/* ═════════════ 기억 발견 ═════════════ */
function showMemoryFound(m: { id: string; label: string }) {
  const v = runtime.videos.find((x) => x.unlockBy === m.id);
  const run = fsm.isRunning;
  if (run) fsm.push(GameState.PAUSED);
  const el = openModal(
    'memoryModal',
    `<div class="memory-panel"><div class="orb"></div>
     <h2>새로운 기억을 발견했습니다.</h2>
     <p class="sub">${m.label}${v ? ` — <b style="color:#ffe28a">${esc(v.title)}</b>` : ''}</p>
     <div class="stack">
       ${v ? `<button class="btn gold" data-a="watch">${ICONS.play}<span>기록 확인</span></button>` : ''}
       <button class="btn primary" data-a="continue">모험 계속하기</button>
     </div></div>`,
  );
  el.onclick = (e) => {
    const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
    if (!a) return;
    audio.play('click');
    if (a === 'continue') {
      el.remove();
      if (run) fsm.pop();
    } else if (a === 'watch' && v) {
      el.remove();
      openVideo(v, () => {
        if (run) fsm.pop();
      });
    }
  };
}

/* ═════════════ 기록관 ═════════════ */
function openArchive() {
  fsm.push(GameState.ARCHIVE);
  const unlocked = new Set(save.data.unlocked);
  const cards = runtime.videos
    .map((v) => {
      const open = unlocked.has(v.unlockBy);
      const hint = v.unlockBy === 'mem_victory' ? '최종 승리 후 공개' : v.unlockBy === 'mem_turret' ? '적 포탑을 파괴하면 해금' : '협곡 곳곳의 기억을 찾아보세요';
      return `<button class="vcard ${open ? '' : 'locked'}" data-id="${v.id}" ${open ? '' : 'aria-disabled="true"'}>
        <div class="th">${open && v.poster ? `<img src="${esc(v.poster)}" alt="" onerror="this.remove()">` : ''}${open ? ICONS.play : ICONS.lock}</div>
        <div class="meta"><b>${open ? esc(v.title) : '잠긴 기억'}${open && v.duration ? `<span class="badge">${esc(v.duration)}</span>` : ''}</b>
        <small>${open ? esc(v.description) : hint}</small></div></button>`;
    })
    .join('');
  const count = runtime.videos.filter((v) => unlocked.has(v.unlockBy)).length;
  const el = openModal(
    'archiveModal',
    `<img class="archive-hero" src="${G('diorama')}" alt="" onerror="this.remove()">
     <h2>추억의 기록관</h2><p class="sub">발견한 기억 ${count} / ${runtime.videos.length}</p>
     <div class="archive-list">${cards || '<p class="sub">등록된 기록이 없습니다.</p>'}</div>
     <div class="stack" style="margin-top:14px"><button class="btn" data-a="close">닫기</button></div>`,
  );
  el.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-a="close"]') || t === el) {
      audio.play('click');
      el.remove();
      fsm.pop();
      return;
    }
    const card = t.closest('.vcard') as HTMLElement | null;
    if (!card || card.classList.contains('locked')) return;
    const v = runtime.videos.find((x) => x.id === card.dataset.id);
    if (v) openVideo(v);
  };
}

/* ═════════════ 영상 플레이어 ═════════════ */
function openVideo(v: VideoEntry, onClose?: () => void) {
  fsm.push(GameState.VIDEO);
  audio.music('none');
  const el = h(`<div id="video" class="screen">
    <div class="vbar"><div class="vt">${esc(v.title)}</div>
      <button class="icon-btn" data-a="fs" aria-label="전체화면">${ICONS.fullscreen}</button>
      <button class="icon-btn" data-a="close" aria-label="닫기">${ICONS.close}</button></div>
    <div class="vstage"></div>
    <div class="vfoot"><button class="btn primary" data-a="close">게임으로 돌아가기</button></div>
  </div>`);
  root.appendChild(el);
  const stage = $('.vstage', el);
  const placeholder = (reason: string) => {
    stage.innerHTML = `<div class="vplaceholder"><div class="big">${ICONS.play}</div><h3>${esc(v.title)}</h3>
      <p>${esc(v.description)}</p><p style="margin-top:12px;font-size:12.5px;opacity:.75">${reason}</p></div>`;
    ($('[data-a="fs"]', el) as HTMLElement).style.visibility = 'hidden';
  };
  let video: HTMLVideoElement | null = null;
  const fsBtn = $('[data-a="fs"]', el) as HTMLElement;
  /** 영상 요소 생성·재생 (필요한 시점에만 로딩) */
  const mount = (src: string, onFail: () => void) => {
    stage.innerHTML = '';
    fsBtn.style.visibility = '';
    video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'metadata';
    if (v.poster) video.poster = v.poster;
    video.addEventListener('error', onFail, { once: true });
    video.src = src;
    stage.appendChild(video);
    video.play().catch(() => {});
  };
  const unmount = () => {
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video = null;
  };
  const showError = (msg: string, retry?: () => void) => {
    unmount();
    placeholder(msg);
    if (retry) {
      const b = h(`<button class="btn primary" style="margin-top:14px">다시 시도</button>`);
      b.onclick = (e) => {
        e.stopPropagation();
        retry();
      };
      stage.querySelector('.vplaceholder')!.appendChild(b);
    }
  };
  if (__EDITION__ === 'private') {
    import('./privateVideo').then((pv) => {
      const askCode = (msg = '') => {
        unmount();
        fsBtn.style.visibility = 'hidden';
        stage.innerHTML = `<form class="vplaceholder vcode"><div class="big">${ICONS.lock}</div><h3>입장 코드를 입력해 주세요</h3>
          <p>선물 영상은 입장 코드가 있어야 볼 수 있습니다.</p>
          <input type="password" autocomplete="off" inputmode="text" maxlength="64" aria-label="입장 코드" placeholder="입장 코드">
          <p class="err">${esc(msg)}</p><button class="btn primary" type="submit">확인</button></form>`;
        const form = stage.querySelector('form')!;
        const input = form.querySelector('input')!;
        form.onsubmit = async (e) => {
          e.preventDefault();
          if (await pv.login(input.value)) play();
          else askCode('입장 코드가 맞지 않습니다.');
        };
        setTimeout(() => input.focus(), 50);
      };
      const play = () => {
        stage.innerHTML = '<div class="vplaceholder"><p>영상을 불러오는 중…</p></div>';
        mount(pv.videoUrl(v.id), async () => {
          const why = await pv.diagnose(v.id);
          if (why === 'auth') askCode('인증이 만료되었습니다. 다시 입력해 주세요.');
          else if (why === 'missing') showError('영상이 아직 준비되지 않았습니다. (곧 업로드될 예정입니다)');
          else showError('영상을 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.', play);
        });
      };
      // 최초 확인 결과가 아니라 현재 인증 상태 기준 (코드 입력 후 다른 영상도 바로 재생)
      pv.initPrivateAuth().then(() => (pv.isAuthed() ? play() : askCode()));
    });
  } else if (v.src) {
    const tryPlay = () => mount(v.src!, () => showError('영상을 불러오지 못했습니다.', tryPlay));
    tryPlay();
  } else {
    // PUBLIC: 비공개 기념 콘텐츠 안내
    fsBtn.style.visibility = 'hidden';
    stage.innerHTML = `<div class="vplaceholder private-note"><div class="big">${ICONS.lock}</div>
      <h3>비공개 기념 콘텐츠</h3>
      <p>이 자리에는 퇴직 선물로 함께 전달된 기념 영상이 들어갑니다.<br>
      실제 인물이 등장하는 영상과 개인적인 메시지는 선물 버전에서만 열람할 수 있습니다.</p></div>`;
  }
  const close = () => {
    unmount();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    el.remove();
    fsm.pop();
    const base = fsm.baseState;
    if (base === GameState.BOSS_BATTLE) audio.music('boss');
    else if (base === GameState.VICTORY) audio.music('victory');
    else if (base === GameState.TITLE) audio.music('title');
    else audio.music('field');
    onClose?.();
  };
  el.onclick = (e) => {
    const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
    if (a === 'close') close();
    else if (a === 'fs' && video) {
      const vv = video as any;
      if (vv.webkitEnterFullscreen && !document.fullscreenEnabled) vv.webkitEnterFullscreen();
      else (video.requestFullscreen?.() || Promise.resolve()).catch(() => vv.webkitEnterFullscreen?.());
    }
  };
}

/* ═════════════ 승리 ═════════════ */
function showVictory() {
  $('#hud').classList.add('hidden');
  const el = h(`<div id="victory" class="screen">
    <div class="rays"></div>
    <div class="vic">VICTORY</div>
    ${artImg(championImg('victory'), 'victory', 'champ')}
    <div class="l1">${esc(runtime.ending.title)}</div>
    <div class="l2">${esc(runtime.ending.line1)}</div>
    <div class="l3">${esc(runtime.ending.line2)}</div>
    <div class="acts">
      ${runtime.ending.thanksButton ? `<button class="btn gold" data-a="thanks">${ICONS.play}<span>${esc(runtime.ending.thanksButton)}</span></button>` : ''}
      <button class="btn" data-a="archive">${ICONS.archive}<span>추억의 기록관</span></button>
      <button class="btn ghost" data-a="again">다시 플레이</button>
    </div>
  </div>`);
  root.appendChild(el);
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = ['#00DC84', '#00b7ff', '#2870ff', '#6f36ff', '#f5c542', '#fff'][i % 6];
    c.style.animationDuration = 3 + Math.random() * 4 + 's';
    c.style.animationDelay = Math.random() * 3 + 's';
    el.appendChild(c);
  }
  el.onclick = (e) => {
    const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
    if (!a) return;
    audio.play('click');
    if (a === 'thanks') {
      const v = runtime.videos.find((x) => x.id === runtime.ending.thanksVideo);
      if (v) openVideo(v);
    } else if (a === 'archive') openArchive();
    else if (a === 'again') {
      el.remove();
      hooks.quitToTitle();
    }
  };
}

export function removeVictory() {
  $('#victory')?.remove();
}

function esc(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
