/**
 * 시작 화면·비공개 입장 화면 공통 연출 (CSS 만 사용, 입력 차단 없음).
 * 일러스트 위 좌표는 CSS 변수로 지정: 세로 포스터(기본) / PC 시작 화면(#title .tl-art).
 * 사용처: src/ui/ui.ts(시작 화면), functions/_middleware.ts(입장 코드 화면)
 */
const clouds = [
  ['8%', '34%', '46s', '-6s'],
  ['20%', '26%', '58s', '-30s'],
  ['31%', '40%', '70s', '-48s'],
];
const flies = [
  ['12%', '8%', '18px', '-22px', '7s', '0s'],
  ['24%', '30%', '-16px', '-18px', '9s', '-2s'],
  ['38%', '14%', '22px', '-12px', '8s', '-4s'],
  ['52%', '36%', '-20px', '-26px', '10s', '-1s'],
  ['64%', '10%', '14px', '-20px', '7.5s', '-5s'],
  ['76%', '28%', '-18px', '-14px', '9.5s', '-3s'],
  ['88%', '16%', '16px', '-24px', '8.5s', '-6s'],
  ['46%', '52%', '-14px', '-20px', '11s', '-7s'],
  ['8%', '46%', '20px', '-16px', '10s', '-8s'],
  ['92%', '44%', '-22px', '-18px', '9s', '-2.5s'],
];
const embers = [
  ['16%', '0s', '5.5s'],
  ['27%', '-1.2s', '6.5s'],
  ['41%', '-2.6s', '5s'],
  ['55%', '-0.6s', '6s'],
  ['69%', '-3.4s', '5.8s'],
  ['83%', '-1.9s', '6.8s'],
];

export const FX_HTML =
  '<i class="fx-rays"></i>' +
  clouds.map(([y, w, d, dl]) => `<i class="fx-cloud" style="--y:${y};--w:${w};--d:${d};--dl:${dl}"></i>`).join('') +
  '<i class="fx-beams"></i><i class="fx-flare"></i><i class="fx-logoglow"></i><i class="fx-shine"></i>' +
  flies.map(([x, y, dx, dy, d, dl]) => `<i class="fx-fly" style="--x:${x};--y:${y};--dx:${dx};--dy:${dy};--d:${d};--dl:${dl}"></i>`).join('') +
  embers.map(([x, dl, d]) => `<i class="fx-ember" style="--x:${x};--dl:${dl};--d:${d}"></i>`).join('') +
  '<i class="fx-intro"></i>';

export const FX_CSS = `
.welcome-fx { --logo-x:9%; --logo-y:3%; --logo-w:82%; --logo-h:18%; --sky-h:40%; --ff-top:46%; --ff-h:40%; }
#title .tl-art .welcome-fx { --logo-x:27%; --logo-y:4%; --logo-w:48%; --logo-h:33%; --sky-h:48%; --ff-top:58%; --ff-h:38%; }
.welcome-fx > i { position:absolute; pointer-events:none; }

/* 하늘: 햇살 · 구름 */
.fx-rays { right:-12%; top:-18%; width:78%; height:var(--sky-h); transform-origin:100% 0;
  background:repeating-conic-gradient(from 196deg at 100% 0%, rgba(255,246,214,0) 0deg 5deg, rgba(255,246,214,.26) 7deg 9deg, rgba(255,246,214,0) 11deg 17deg);
  -webkit-mask-image:radial-gradient(circle at 100% 0, #000 18%, transparent 78%); mask-image:radial-gradient(circle at 100% 0, #000 18%, transparent 78%);
  mix-blend-mode:screen; animation:fxRays 9s ease-in-out infinite; }
.fx-cloud { top:var(--y); left:-40%; width:var(--w); aspect-ratio:3 / 1; opacity:.55; filter:blur(2px);
  background:radial-gradient(30% 42% at 30% 62%, rgba(255,255,255,.95), rgba(255,255,255,0) 100%), radial-gradient(28% 48% at 56% 44%, rgba(255,255,255,.95), rgba(255,255,255,0) 100%), radial-gradient(22% 34% at 80% 64%, rgba(244,251,255,.9), rgba(244,251,255,0) 100%);
  animation:fxCloud var(--d) linear var(--dl) infinite; }

/* 크리스탈: 회전 광선 · 섬광 */
.fx-beams { left:var(--crystal-x); top:var(--crystal-y); width:44%; aspect-ratio:1; translate:-50% -50%;
  background:repeating-conic-gradient(rgba(150,240,255,0) 0deg 9deg, rgba(150,240,255,.42) 12deg 14deg, rgba(150,240,255,0) 17deg 30deg);
  -webkit-mask-image:radial-gradient(circle, #000 8%, transparent 62%); mask-image:radial-gradient(circle, #000 8%, transparent 62%);
  mix-blend-mode:screen; animation:fxSpin 16s linear infinite, fxBeamPulse 4.8s ease-in-out infinite; }
.fx-flare { left:var(--crystal-x); top:var(--crystal-y); width:16%; aspect-ratio:1; translate:-50% -50%; border-radius:50%;
  background:radial-gradient(circle, #ffffff 0 10%, #b8fbff 22%, rgba(60,220,255,.35) 45%, transparent 70%); mix-blend-mode:screen; opacity:0;
  animation:fxFlare 4.8s ease-out 1.4s infinite; }

/* 로고: 광택 · 금빛 후광 */
.fx-logoglow { left:var(--logo-x); top:var(--logo-y); width:var(--logo-w); height:var(--logo-h);
  background:radial-gradient(ellipse at 50% 50%, rgba(255,214,110,.55), transparent 68%); mix-blend-mode:screen; animation:fxLogoGlow 3.6s ease-in-out infinite; }
.fx-shine { left:var(--logo-x); top:var(--logo-y); width:var(--logo-w); height:var(--logo-h); overflow:hidden; mix-blend-mode:screen;
  -webkit-mask-image:radial-gradient(ellipse at center, #000 55%, transparent 80%); mask-image:radial-gradient(ellipse at center, #000 55%, transparent 80%); }
.fx-shine::before { content:''; position:absolute; top:-30%; bottom:-30%; left:-35%; width:26%; transform:skewX(-20deg);
  background:linear-gradient(90deg, transparent, rgba(255,250,225,.85) 50%, transparent); animation:fxShine 4.6s ease-in-out 1.6s infinite; }

/* 숲: 반딧불 · 금빛 불씨 */
.fx-fly { left:var(--x); top:calc(var(--ff-top) + var(--y) * .7); width:6px; height:6px; border-radius:50%;
  background:#efff9a; box-shadow:0 0 8px 3px rgba(214,255,110,.75), 0 0 18px 6px rgba(180,255,90,.25); opacity:0;
  animation:fxFly var(--d) ease-in-out var(--dl) infinite; }
.fx-ember { left:var(--x); bottom:4%; width:5px; height:5px; border-radius:50%; background:#ffe9a0; box-shadow:0 0 10px 4px rgba(255,190,60,.7); opacity:0;
  animation:fxEmber var(--d) linear var(--dl) infinite; }

/* 첫 등장: 어둠에서 빛이 퍼지며 열림 */
.fx-intro { inset:0; background:radial-gradient(circle at var(--crystal-x) var(--crystal-y), rgba(220,252,255,.95) 0, rgba(80,200,255,.5) 12%, #020814 46%);
  animation:fxIntro 1.7s cubic-bezier(.3,.7,.2,1) forwards; }
#title .tl-art > img { animation:fxArtIn 1.9s cubic-bezier(.2,.8,.2,1) both; }
#title.poster-title .tp { animation:fxArtIn 1.9s cubic-bezier(.2,.8,.2,1) both; }

/* 시작·입장 버튼: 빛 고리 + 광택 */
#title .tl .hot[data-act=start], #startBtn, .entry-panel button { isolation:isolate; }
#startBtn, .entry-panel button { position:relative; }
#title .tl .hot[data-act=start]::before, #startBtn::before, .entry-panel button::before {
  content:''; position:absolute; inset:-3px; border-radius:inherit; pointer-events:none; animation:fxBtnPulse 2.4s ease-out 1.8s infinite; }
#title .tl .hot[data-act=start]::after, #startBtn::after, .entry-panel button::after {
  content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background:linear-gradient(105deg, transparent 38%, rgba(255,255,255,.6) 50%, transparent 62%) no-repeat; background-size:260% 100%; background-position:160% 0;
  animation:fxBtnShine 3.8s ease-in-out 2.2s infinite; }
#startBtn:disabled::before, #startBtn:disabled::after { animation:none; }

@keyframes fxRays { 0%,100% { rotate:-3deg; opacity:.55; } 50% { rotate:4deg; opacity:1; } }
@keyframes fxCloud { from { left:-40%; } to { left:110%; } }
@keyframes fxSpin { to { rotate:360deg; } }
@keyframes fxBeamPulse { 0%,100% { opacity:.45; } 50% { opacity:.95; } }
@keyframes fxFlare { 0% { opacity:0; scale:.4; } 10% { opacity:.95; scale:1.15; } 35% { opacity:0; scale:1.9; } 100% { opacity:0; scale:1.9; } }
@keyframes fxLogoGlow { 0%,100% { opacity:.25; } 50% { opacity:.6; } }
@keyframes fxShine { 0% { left:-35%; } 38%,100% { left:125%; } }
@keyframes fxFly { 0% { opacity:0; translate:0 0; } 15% { opacity:1; } 35% { opacity:.35; } 50% { opacity:1; translate:var(--dx) var(--dy); }
  70% { opacity:.5; } 85% { opacity:.9; } 100% { opacity:0; translate:calc(var(--dx) * -0.7) calc(var(--dy) * 1.6); } }
@keyframes fxEmber { 0% { opacity:0; translate:0 0; } 12% { opacity:.95; } 70% { opacity:.6; } 100% { opacity:0; translate:18px -46vh; } }
@keyframes fxIntro { 0% { opacity:1; } 35% { opacity:.85; } 100% { opacity:0; visibility:hidden; } }
@keyframes fxArtIn { from { opacity:.2; transform:scale(1.07); filter:saturate(.6) brightness(.7); } to { opacity:1; transform:none; filter:none; } }
@keyframes fxBtnPulse { 0% { box-shadow:0 0 0 0 rgba(255,214,110,.75); } 70% { box-shadow:0 0 0 14px rgba(255,214,110,0); } 100% { box-shadow:0 0 0 0 rgba(255,214,110,0); } }
@keyframes fxBtnShine { 0% { background-position:160% 0; } 40%,100% { background-position:-60% 0; } }

@media (prefers-reduced-motion: reduce) {
  .welcome-fx > i, .fx-shine::before, #title .tl-art > img, #title.poster-title .tp,
  #title .tl .hot[data-act=start]::before, #title .tl .hot[data-act=start]::after, #startBtn::before, #startBtn::after,
  .entry-panel button::before, .entry-panel button::after { animation:none !important; }
  .fx-intro, .fx-fly, .fx-ember, .fx-flare, .fx-cloud { display:none; }
}
`;
