/**
 * 게임 내장 오리지널 그래픽 (SVG).
 * 외부 이미지가 없어도 동작하도록 모든 캐릭터·구조물을 코드로 그립니다.
 * public/config/assets.json 에서 이미지 경로를 지정하면 해당 이미지로 교체됩니다.
 */
const O = '#141826'; // 외곽선
const SW = 'stroke="' + O + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** 굵은 외곽선이 있는 팔/막대 */
const limb = (x1: number, y1: number, x2: number, y2: number, color: string, w = 9) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${O}" stroke-width="${w + 5}" stroke-linecap="round"/>` +
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;

const hand = (x: number, y: number, r = 5.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffd9b8" ${SW}/>`;

/* ───────────── 부장님 챔피언 : GAME MASTER ───────────── */
export const FACE_ANCHOR = { x: 64, y: 50, r: 30, w: 128, h: 160 };

export type ChampPose = 'idle' | 'attack' | 'victory';

export function championSvg(pose: ChampPose, withFace = true) {
  const suit = '#22305e';
  const staff = (x1: number, y1: number, x2: number, y2: number, glow: boolean) => `
    ${limb(x1, y1, x2, y2, '#8a5a2b', 5)}
    <circle cx="${x2}" cy="${y2}" r="${glow ? 17 : 12}" fill="#00b7ff" opacity="${glow ? 0.35 : 0.18}"/>
    <circle cx="${x2}" cy="${y2}" r="10" fill="none" stroke="#f5c542" stroke-width="3.5"/>
    <path d="M${x2} ${y2 - 9} L${x2 + 6} ${y2} L${x2} ${y2 + 9} L${x2 - 6} ${y2} Z" fill="${glow ? '#bff0ff' : '#00b7ff'}" stroke="${O}" stroke-width="2"/>
    <circle cx="${x2 - 2}" cy="${y2 - 3}" r="1.6" fill="#fff"/>`;

  let arms = '';
  let back = '';
  if (pose === 'idle') {
    back = staff(98, 140, 98, 50, false);
    arms = limb(47, 82, 40, 108, suit) + hand(40, 110) + limb(81, 82, 95, 104, suit) + hand(97, 104);
  } else if (pose === 'attack') {
    arms = limb(47, 82, 38, 104, suit) + hand(38, 106) + staff(76, 118, 118, 64, true) + limb(81, 82, 100, 92, suit) + hand(101, 92);
  } else {
    back = staff(104, 92, 104, 12, true);
    arms = limb(46, 82, 28, 58, suit) + hand(27, 55) + limb(82, 82, 101, 64, suit) + hand(102, 62);
  }

  const face = withFace
    ? `
    <path d="M47 41 Q53 37 59 40" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M69 40 Q75 37 81 41" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="55" cy="52" rx="4.2" ry="5.6" fill="${O}"/>
    <ellipse cx="75" cy="52" rx="4.2" ry="5.6" fill="${O}"/>
    <circle cx="56.5" cy="50" r="1.7" fill="#fff"/><circle cx="76.5" cy="50" r="1.7" fill="#fff"/>
    <ellipse cx="47" cy="62" rx="5" ry="3" fill="#ff8f8f" opacity=".55"/>
    <ellipse cx="83" cy="62" rx="5" ry="3" fill="#ff8f8f" opacity=".55"/>
    ${pose === 'victory'
      ? `<path d="M58 63 Q65 73 72 63 Z" fill="#7a2a2a" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>`
      : `<path d="M59 64 Q65 69 71 64" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`}`
    : '';

  return svg(
    128,
    160,
    `
    <!-- 망토 -->
    <path d="M40 80 Q26 120 30 146 L98 146 Q102 118 88 80 Z" fill="#2870ff" ${SW}/>
    <path d="M36 138 Q64 132 94 138 L98 146 L30 146 Z" fill="#1a4fd0"/>
    <path d="M31 145 L97 145" stroke="#f5c542" stroke-width="3.5"/>
    ${back}
    <!-- 다리 -->
    <rect x="50" y="122" width="11" height="20" rx="4" fill="#1b2340" ${SW}/>
    <rect x="67" y="122" width="11" height="20" rx="4" fill="#1b2340" ${SW}/>
    <ellipse cx="54" cy="145" rx="9" ry="5" fill="#2a1c14" ${SW}/>
    <ellipse cx="75" cy="145" rx="9" ry="5" fill="#2a1c14" ${SW}/>
    <!-- 몸통 -->
    <path d="M44 88 Q44 76 55 75 L73 75 Q84 76 84 88 L86 126 Q64 133 42 126 Z" fill="${suit}" ${SW}/>
    <path d="M57 75 L64 92 L71 75 Z" fill="#ffffff"/>
    <path d="M62 79 L66 79 L67.5 97 L64 101 L60.5 97 Z" fill="#00b7ff" stroke="${O}" stroke-width="1.6"/>
    <path d="M44 112 Q64 118 85 112" stroke="#f5c542" stroke-width="4" fill="none"/>
    <rect x="60" y="111" width="9" height="7" rx="2" fill="#f5c542" stroke="${O}" stroke-width="1.6"/>
    <path d="M72 88 l7 0 l0 6 q-3.5 4 -7 0 z" fill="#f5c542" stroke="${O}" stroke-width="1.4"/>
    <path d="M45 80 Q50 76 56 76" stroke="#f5c542" stroke-width="3" fill="none"/>
    <path d="M83 80 Q78 76 72 76" stroke="#f5c542" stroke-width="3" fill="none"/>
    ${arms}
    <!-- 머리 -->
    <circle cx="64" cy="50" r="30" fill="#ffd9b8" ${SW}/>
    <path d="M33 50 Q31 16 64 16 Q97 16 95 48 Q90 36 80 33 Q66 38 50 31 Q41 37 36 52 Z" fill="#2b2a35" ${SW}/>
    <path d="M52 22 Q62 18 72 21" stroke="#4a4858" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M37 34 Q64 22 91 34" stroke="#f5c542" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="64" cy="26" r="4.6" fill="#00b7ff" stroke="${O}" stroke-width="2"/>
    ${face}
  `,
  );
}

/* ───────────── 아군 미니언 ───────────── */
const smallFace = (cx: number, cy: number, mood: 'happy' | 'focus' = 'happy') => `
  <ellipse cx="${cx - 5}" cy="${cy}" rx="2.4" ry="3.2" fill="${O}"/>
  <ellipse cx="${cx + 6}" cy="${cy}" rx="2.4" ry="3.2" fill="${O}"/>
  <circle cx="${cx - 4.3}" cy="${cy - 1}" r="0.9" fill="#fff"/><circle cx="${cx + 6.7}" cy="${cy - 1}" r="0.9" fill="#fff"/>
  ${mood === 'happy'
    ? `<path d="M${cx - 3} ${cy + 6} Q${cx + 0.5} ${cy + 9} ${cx + 4} ${cy + 6}" stroke="${O}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
    : `<path d="M${cx - 2} ${cy + 7} L${cx + 3} ${cy + 7}" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>`}
  <ellipse cx="${cx - 9}" cy="${cy + 5}" rx="3" ry="1.8" fill="#ff8f8f" opacity=".5"/>
  <ellipse cx="${cx + 10}" cy="${cy + 5}" rx="3" ry="1.8" fill="#ff8f8f" opacity=".5"/>`;

const SW2 = 'stroke="' + O + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';

/** 추진팀: 헬멧 + 작은 방패(파란 방패 마크) + 근접 */
export function minionPushSvg() {
  return svg(
    72,
    80,
    `
    <path d="M14 34 L8 22" stroke="${O}" stroke-width="7" stroke-linecap="round"/>
    <path d="M14 34 L8 22" stroke="#d9dee8" stroke-width="3.5" stroke-linecap="round"/>
    <rect x="25" y="62" width="8" height="12" rx="3" fill="#1b2a52" ${SW2}/>
    <rect x="38" y="62" width="8" height="12" rx="3" fill="#1b2a52" ${SW2}/>
    <path d="M20 50 Q20 40 30 39 L42 39 Q51 40 51 50 L52 66 Q36 71 19 66 Z" fill="#2870ff" ${SW2}/>
    <path d="M20 58 L52 58" stroke="#f5c542" stroke-width="3"/>
    <circle cx="16" cy="52" r="4.5" fill="#ffd9b8" ${SW2}/>
    <circle cx="35" cy="28" r="16" fill="#ffd9b8" ${SW2}/>
    ${smallFace(37, 30, 'focus')}
    <path d="M18 27 Q18 9 35 9 Q53 9 53 27 L53 22 Q35 16 18 22 Z" fill="#3d8bff" ${SW2}/>
    <path d="M17 25 Q35 18 54 25" stroke="${O}" stroke-width="5" fill="none"/>
    <path d="M17 25 Q35 18 54 25" stroke="#7fb3ff" stroke-width="2.5" fill="none"/>
    <path d="M35 9 L35 3" stroke="${O}" stroke-width="6" stroke-linecap="round"/>
    <path d="M35 9 L35 3" stroke="#f5c542" stroke-width="3" stroke-linecap="round"/>
    <!-- 방패 -->
    <path d="M48 38 L64 42 L63 56 Q57 66 50 68 Q44 62 44 56 Z" fill="#1d4fd6" ${SW2}/>
    <path d="M48 38 L64 42 L63 56 Q57 66 50 68 Q44 62 44 56 Z" fill="none" stroke="#f5c542" stroke-width="1.6" transform="translate(1.5 2) scale(.94)"/>
    <path d="M48 56 L54 48 L60 56" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M48 61 L54 53 L60 61" stroke="#9fd0ff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  );
}

/** 개발팀: 후드 + 안경 + 노트북 + 소형 드론(회로 마크) */
export function minionDevSvg() {
  return svg(
    72,
    80,
    `
    <!-- 드론 -->
    <g>
      <line x1="52" y1="10" x2="68" y2="10" stroke="${O}" stroke-width="2"/>
      <ellipse cx="52" cy="9" rx="5" ry="1.6" fill="#9fb2c8"/><ellipse cx="68" cy="9" rx="5" ry="1.6" fill="#9fb2c8"/>
      <rect x="54" y="11" width="12" height="8" rx="3" fill="#e5ecf5" ${SW2}/>
      <circle cx="60" cy="15" r="2" fill="#00DC84"/>
    </g>
    <rect x="25" y="62" width="8" height="12" rx="3" fill="#2b3446" ${SW2}/>
    <rect x="38" y="62" width="8" height="12" rx="3" fill="#2b3446" ${SW2}/>
    <path d="M19 50 Q19 39 30 38 L42 38 Q52 39 52 50 L53 66 Q36 71 18 66 Z" fill="#00a6e8" ${SW2}/>
    <path d="M27 40 L35 48 L43 40" stroke="#0a7fb8" stroke-width="3" fill="none"/>
    <!-- 회로 마크 -->
    <path d="M24 56 l5 0 l3 -3 l5 0" stroke="#bff0ff" stroke-width="1.6" fill="none"/>
    <circle cx="24" cy="56" r="1.6" fill="#bff0ff"/><circle cx="37" cy="53" r="1.6" fill="#bff0ff"/>
    <!-- 후드 -->
    <path d="M17 30 Q16 10 35 10 Q55 10 54 30 Q55 40 50 42 L20 42 Q15 40 17 30 Z" fill="#0090cc" ${SW2}/>
    <circle cx="35" cy="29" r="14.5" fill="#ffd9b8" ${SW2}/>
    <path d="M21 26 Q22 14 35 14 Q48 14 49 25 Q42 20 35 22 Q28 19 21 26 Z" fill="#3a2e2a"/>
    ${smallFace(36, 31)}
    <rect x="25" y="26" width="10" height="8" rx="3" fill="none" stroke="${O}" stroke-width="2"/>
    <rect x="37" y="26" width="10" height="8" rx="3" fill="none" stroke="${O}" stroke-width="2"/>
    <line x1="35" y1="29" x2="37" y2="29" stroke="${O}" stroke-width="2"/>
    <!-- 노트북 -->
    <path d="M40 46 L62 42 L64 58 L42 62 Z" fill="#c9d3e0" ${SW2}/>
    <path d="M43 48 L60 45 L61.5 56 L44.5 59 Z" fill="#0d2a22"/>
    <path d="M46 50 l7 -1 M46 53 l10 -1.6 M46 56 l5 -0.8" stroke="#00DC84" stroke-width="1.4"/>
    <path d="M38 63 L66 58 L68 61 L40 66 Z" fill="#9aa7b8" ${SW2}/>
    <circle cx="41" cy="60" r="4.5" fill="#ffd9b8" ${SW2}/>
  `,
  );
}

/** 사업팀: 정장 + 서류가방 + 어깨 위 소형 복합기 대포(계약서 마크) */
export function minionBizSvg() {
  return svg(
    76,
    80,
    `
    <rect x="25" y="62" width="8" height="12" rx="3" fill="#121a33" ${SW2}/>
    <rect x="38" y="62" width="8" height="12" rx="3" fill="#121a33" ${SW2}/>
    <path d="M19 50 Q19 39 30 38 L42 38 Q52 39 52 50 L53 66 Q36 71 18 66 Z" fill="#1d2a5a" ${SW2}/>
    <path d="M30 38 L36 50 L42 38 Z" fill="#fff"/>
    <path d="M34.5 41 L37.5 41 L38.5 54 L36 57 L33.5 54 Z" fill="#00DC84" stroke="${O}" stroke-width="1.2"/>
    <!-- 계약서 마크 -->
    <rect x="42" y="48" width="7" height="9" rx="1" fill="#fff" stroke="${O}" stroke-width="1.2"/>
    <circle cx="47" cy="55" r="2" fill="#e5484d"/>
    <!-- 서류가방 -->
    <rect x="6" y="54" width="16" height="12" rx="2" fill="#8a5a2b" ${SW2}/>
    <path d="M11 54 L11 51 L17 51 L17 54" stroke="${O}" stroke-width="2" fill="none"/>
    <rect x="12.5" y="58" width="3" height="3" fill="#f5c542"/>
    <circle cx="17" cy="51" r="4.5" fill="#ffd9b8" ${SW2}/>
    <circle cx="35" cy="28" r="15" fill="#ffd9b8" ${SW2}/>
    <path d="M20 26 Q19 12 35 12 Q51 12 50 25 Q44 17 36 19 Q30 22 22 21 Z" fill="#2b2420" ${SW2}/>
    ${smallFace(37, 30)}
    <!-- 복합기 대포 -->
    <rect x="42" y="22" width="26" height="16" rx="3" fill="#eef2f7" ${SW2}/>
    <rect x="45" y="18" width="18" height="6" rx="2" fill="#d7dee8" ${SW2}/>
    <rect x="66" y="27" width="8" height="7" rx="1.5" fill="#9aa7b8" ${SW2}/>
    <rect x="46" y="31" width="14" height="2.5" fill="#384152"/>
    <circle cx="63" cy="26" r="1.8" fill="#00DC84"/>
    <path d="M48 38 L48 44" stroke="${O}" stroke-width="4"/>
  `,
  );
}

/* ───────────── 적: 보안 위협 ───────────── */
export function bugSvg() {
  return svg(
    72,
    60,
    `
    <g stroke="${O}" stroke-width="3" stroke-linecap="round">
      <path d="M24 36 L12 44 L8 52"/><path d="M34 40 L28 52"/><path d="M44 38 L50 52"/>
      <path d="M26 28 L12 22 L6 26"/><path d="M48 30 L60 26"/>
    </g>
    <ellipse cx="38" cy="32" rx="22" ry="16" fill="#5a26c9" ${SW}/>
    <path d="M38 16 L38 47" stroke="${O}" stroke-width="2.4"/>
    <ellipse cx="31" cy="26" rx="7" ry="4" fill="#8b5cff" opacity=".7"/>
    <ellipse cx="45" cy="26" rx="6" ry="3.5" fill="#8b5cff" opacity=".5"/>
    <circle cx="58" cy="34" r="11" fill="#2d1466" ${SW}/>
    <path d="M60 24 Q64 10 70 12" stroke="${O}" stroke-width="2.4" fill="none"/>
    <path d="M56 24 Q54 10 60 6" stroke="${O}" stroke-width="2.4" fill="none"/>
    <circle cx="70" cy="12" r="2.4" fill="#ff2e4d"/><circle cx="60" cy="6" r="2.4" fill="#ff2e4d"/>
    <circle cx="57" cy="33" r="5" fill="#ff2e4d" opacity=".35"/>
    <circle cx="65" cy="33" r="5" fill="#ff2e4d" opacity=".35"/>
    <ellipse cx="57" cy="33" rx="2.6" ry="3.2" fill="#ff2e4d"/>
    <ellipse cx="65" cy="33" rx="2.6" ry="3.2" fill="#ff2e4d"/>
    <rect x="16" y="12" width="5" height="3" fill="#00e5ff" opacity=".8"/>
    <rect x="10" y="18" width="3" height="3" fill="#ff3bd4" opacity=".8"/>
    <rect x="22" y="44" width="6" height="2.5" fill="#00e5ff" opacity=".6"/>
  `,
  );
}

export function phishingSvg() {
  return svg(
    84,
    72,
    `
    <path d="M24 30 Q8 14 2 26 Q10 28 6 36 Q14 34 14 42 Q20 36 26 40 Z" fill="#5b2bb3" ${SW2}/>
    <path d="M60 30 Q76 14 82 26 Q74 28 78 36 Q70 34 70 42 Q64 36 58 40 Z" fill="#5b2bb3" ${SW2}/>
    <rect x="20" y="22" width="44" height="30" rx="4" fill="#ece6ff" ${SW}/>
    <path d="M20 24 L42 42 L64 24" fill="#d6ccff" ${SW}/>
    <path d="M30 34 L38 36" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M54 34 L46 36" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="35" cy="40" r="2.6" fill="#e5134d"/><circle cx="49" cy="40" r="2.6" fill="#e5134d"/>
    <path d="M36 48 Q42 45 48 48" stroke="${O}" stroke-width="2" fill="none"/>
    <!-- 경고 아이콘 -->
    <path d="M60 6 L72 26 L48 26 Z" fill="#ffcc00" ${SW2}/>
    <path d="M60 12 L60 19" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/><circle cx="60" cy="23" r="1.4" fill="${O}"/>
    <!-- 낚싯바늘 -->
    <path d="M42 52 L42 62 Q42 68 36 66 Q33 64 35 60" stroke="#c9d3e0" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  `,
  );
}

export function ransomwareSvg() {
  return svg(
    96,
    104,
    `
    <path d="M30 40 L30 26 Q30 8 48 8 Q66 8 66 26 L66 40" stroke="${O}" stroke-width="14" fill="none"/>
    <path d="M30 40 L30 26 Q30 8 48 8 Q66 8 66 26 L66 40" stroke="#c9a640" stroke-width="8" fill="none"/>
    <path d="M36 22 Q40 14 48 14" stroke="#f3dc8a" stroke-width="2.5" fill="none"/>
    <rect x="34" y="82" width="11" height="16" rx="4" fill="#24104d" ${SW}/>
    <rect x="52" y="82" width="11" height="16" rx="4" fill="#24104d" ${SW}/>
    ${limb(18, 56, 8, 72, '#3a1670', 9)}${limb(78, 56, 88, 72, '#3a1670', 9)}
    <circle cx="8" cy="74" r="6" fill="#5b2bb3" ${SW2}/><circle cx="88" cy="74" r="6" fill="#5b2bb3" ${SW2}/>
    <path d="M88 80 l0 6 m-3 3 l6 0 m-3 3 l0 6" stroke="#9aa7b8" stroke-width="2.6"/>
    <rect x="16" y="36" width="64" height="52" rx="10" fill="#3a1670" ${SW}/>
    <rect x="22" y="42" width="52" height="40" rx="7" fill="#4b1f94"/>
    <path d="M16 50 L80 50 M16 76 L80 76" stroke="#6f36ff" stroke-width="2.5"/>
    <circle cx="22" cy="44" r="2" fill="#9aa7b8"/><circle cx="74" cy="44" r="2" fill="#9aa7b8"/>
    <circle cx="22" cy="82" r="2" fill="#9aa7b8"/><circle cx="74" cy="82" r="2" fill="#9aa7b8"/>
    <path d="M32 56 L44 60 M64 56 L52 60" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="40" cy="62" rx="4" ry="2.4" fill="#ff2e4d"/><ellipse cx="56" cy="62" rx="4" ry="2.4" fill="#ff2e4d"/>
    <circle cx="48" cy="70" r="8" fill="#ff2e4d" opacity=".3"/>
    <circle cx="48" cy="68" r="4" fill="#ff2e4d" stroke="${O}" stroke-width="2"/>
    <path d="M46 70 L44.5 78 L51.5 78 L50 70 Z" fill="#ff2e4d" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
  `,
  );
}

export function zeroDaySvg() {
  return svg(
    160,
    190,
    `
    <!-- 망토 -->
    <path d="M44 70 Q24 130 22 178 L40 168 L52 182 L66 168 L80 184 L94 168 L108 182 L120 168 L138 178 Q136 130 116 70 Z" fill="#3b1270" ${SW}/>
    <path d="M40 160 L52 172 L66 160 L80 174 L94 160 L108 172 L120 160" stroke="#8a3cff" stroke-width="2" fill="none"/>
    <!-- 다리 -->
    <rect x="58" y="138" width="16" height="36" rx="5" fill="#16101f" ${SW}/>
    <rect x="86" y="138" width="16" height="36" rx="5" fill="#16101f" ${SW}/>
    <path d="M54 176 L78 176 L76 168 L58 168 Z" fill="#2a1d3d" ${SW}/>
    <path d="M82 176 L106 176 L104 168 L86 168 Z" fill="#2a1d3d" ${SW}/>
    <!-- 왼팔 -->
    ${limb(52, 84, 34, 122, '#1d1430', 14)}
    <circle cx="33" cy="125" r="9" fill="#2a1d3d" ${SW}/>
    <!-- 몸통 -->
    <path d="M50 84 Q50 66 66 64 L94 64 Q110 66 110 84 L112 142 Q80 152 48 142 Z" fill="#16101f" ${SW}/>
    <path d="M58 76 L80 120 L102 76" stroke="#8a3cff" stroke-width="3" fill="none"/>
    <circle cx="80" cy="100" r="13" fill="#ff2fd0" opacity=".25"/>
    <circle cx="80" cy="100" r="9" fill="#16101f" stroke="#ff2fd0" stroke-width="3.5"/>
    <path d="M75 106 L85 94" stroke="#ff2fd0" stroke-width="2.5"/>
    <path d="M50 128 L110 128" stroke="#8a3cff" stroke-width="4"/>
    <!-- 견갑 -->
    <path d="M38 78 Q40 60 60 62 L64 82 Q50 90 38 78 Z" fill="#2a1d3d" ${SW}/>
    <path d="M40 64 L32 50 L50 60 Z" fill="#8a3cff" ${SW2}/>
    <path d="M122 78 Q120 60 100 62 L96 82 Q110 90 122 78 Z" fill="#2a1d3d" ${SW}/>
    <path d="M120 64 L128 50 L110 60 Z" fill="#8a3cff" ${SW2}/>
    <!-- 오른팔 + 에너지 검 -->
    <path d="M118 112 L150 20" stroke="#ff2fd0" stroke-width="14" opacity=".25" stroke-linecap="round"/>
    <path d="M118 112 L150 20" stroke="${O}" stroke-width="9" stroke-linecap="round"/>
    <path d="M118 112 L150 20" stroke="#ff6be3" stroke-width="5" stroke-linecap="round"/>
    <path d="M119 108 L148 24" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M108 116 L128 122" stroke="${O}" stroke-width="8" stroke-linecap="round"/>
    <path d="M108 116 L128 122" stroke="#8a3cff" stroke-width="4" stroke-linecap="round"/>
    ${limb(108, 84, 118, 114, '#1d1430', 14)}
    <circle cx="118" cy="116" r="9" fill="#2a1d3d" ${SW}/>
    <!-- 투구 -->
    <path d="M56 40 Q56 10 80 10 Q104 10 104 40 L102 62 Q80 72 58 62 Z" fill="#1d1430" ${SW}/>
    <path d="M60 22 Q46 12 40 -2 Q56 6 66 14 Z" fill="#2a1d3d" ${SW}/>
    <path d="M100 22 Q114 12 120 -2 Q104 6 94 14 Z" fill="#2a1d3d" ${SW}/>
    <path d="M62 40 L98 40 L94 50 L66 50 Z" fill="#06030b" stroke="${O}" stroke-width="2"/>
    <path d="M66 44 L94 44" stroke="#ff2e4d" stroke-width="10" opacity=".25"/>
    <path d="M67 44.5 L77 46 M83 46 L93 44.5" stroke="#ff3b6b" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M80 14 L80 34" stroke="#8a3cff" stroke-width="3"/>
    <!-- 글리치 -->
    <rect x="18" y="58" width="16" height="4" fill="#00e5ff" opacity=".7"/>
    <rect x="122" y="96" width="20" height="4" fill="#ff3bd4" opacity=".7"/>
    <rect x="30" y="148" width="10" height="3" fill="#00e5ff" opacity=".6"/>
    <rect x="112" y="40" width="8" height="3" fill="#00e5ff" opacity=".6"/>
  `,
  );
}

/* ───────────── 구조물 ───────────── */
function stoneBase(cx: number, y: number, w: number, color: string, dark: string) {
  const x = cx - w / 2;
  return `
    <path d="M${x} ${y + 10} L${x + 10} ${y} L${x + w - 10} ${y} L${x + w} ${y + 10} L${x + w} ${y + 34} L${x + w - 10} ${y + 42} L${x + 10} ${y + 42} L${x} ${y + 34} Z" fill="${color}" ${SW}/>
    <path d="M${x} ${y + 10} L${x + w} ${y + 10}" stroke="${dark}" stroke-width="2"/>
    <path d="M${x + 2} ${y + 24} L${x + w - 2} ${y + 24}" stroke="${dark}" stroke-width="2"/>
    <path d="M${cx - 18} ${y + 10} L${cx - 18} ${y + 24} M${cx + 14} ${y + 10} L${cx + 14} ${y + 24} M${cx - 2} ${y + 24} L${cx - 2} ${y + 40} M${cx + 26} ${y + 24} L${cx + 26} ${y + 38} M${cx - 30} ${y + 24} L${cx - 30} ${y + 38}" stroke="${dark}" stroke-width="2"/>`;
}

/** 포탑: 석조 기단 + 복합기형 방어장치 + 상단 에너지 코어 */
export function turretSvg(ally: boolean) {
  const body = ally ? '#eef2f7' : '#2c1a4d';
  const panel = ally ? '#2870ff' : '#5b2bb3';
  const core = ally ? '#00b7ff' : '#b06bff';
  const coreHi = ally ? '#bff0ff' : '#ecd9ff';
  const trim = ally ? '#f5c542' : '#ff2e4d';
  const stone = ally ? '#8d93a3' : '#5c5a66';
  const stoneD = ally ? '#6b7080' : '#43414d';
  return svg(
    110,
    150,
    `
    ${stoneBase(55, 104, 92, stone, stoneD)}
    <rect x="34" y="84" width="42" height="24" fill="${stoneD}" ${SW}/>
    <!-- 복합기 -->
    <rect x="18" y="52" width="74" height="38" rx="6" fill="${body}" ${SW}/>
    <rect x="22" y="44" width="66" height="12" rx="4" fill="${panel}" ${SW}/>
    <rect x="28" y="66" width="44" height="6" rx="2" fill="#1a1a24"/>
    <rect x="30" y="72" width="40" height="10" rx="1" fill="#ffffff" stroke="${O}" stroke-width="1.6"/>
    <path d="M34 76 L58 76 M34 79 L50 79" stroke="#9aa7b8" stroke-width="1.2"/>
    <circle cx="80" cy="64" r="3" fill="${trim}"/><circle cx="80" cy="74" r="3" fill="#00DC84"/>
    <path d="M18 60 L92 60" stroke="${trim}" stroke-width="2"/>
    <!-- 코어 -->
    <ellipse cx="55" cy="40" rx="16" ry="5" fill="none" stroke="${trim}" stroke-width="3"/>
    <circle cx="55" cy="22" r="20" fill="${core}" opacity=".25"/>
    <path d="M55 4 L67 22 L55 38 L43 22 Z" fill="${core}" ${SW}/>
    <path d="M55 4 L60 22 L55 38" fill="${coreHi}" opacity=".55"/>
    <circle cx="51" cy="16" r="2.4" fill="#fff"/>
  `,
  );
}

export function inhibitorSvg() {
  return svg(
    90,
    110,
    `
    ${stoneBase(45, 66, 74, '#5c5a66', '#43414d')}
    <path d="M45 6 L74 18 L72 46 Q64 62 45 70 Q26 62 18 46 L16 18 Z" fill="#3a1670" ${SW}/>
    <path d="M45 14 L66 23 L64 44 Q58 56 45 62 Q32 56 26 44 L24 23 Z" fill="#6f36ff"/>
    <path d="M45 14 L66 23 L64 44 Q58 56 45 62" fill="#8b5cff" opacity=".6"/>
    <rect x="36" y="34" width="18" height="15" rx="3" fill="#2d1466" stroke="${O}" stroke-width="2"/>
    <path d="M39 34 L39 29 Q39 23 45 23 Q51 23 51 29 L51 34" stroke="${O}" stroke-width="2.6" fill="none"/>
    <circle cx="45" cy="41" r="2.4" fill="#ff2e4d"/>
    <path d="M18 30 L8 30 L8 50 M72 30 L82 30 L82 50" stroke="#ff2e4d" stroke-width="2" fill="none" opacity=".8"/>
    <circle cx="8" cy="52" r="2.4" fill="#ff2e4d"/><circle cx="82" cy="52" r="2.4" fill="#ff2e4d"/>
  `,
  );
}

export function nexusSvg(ally: boolean) {
  const core = ally ? '#00b7ff' : '#9b4dff';
  const coreD = ally ? '#2870ff' : '#5a1fc0';
  const coreHi = ally ? '#d6f6ff' : '#f0dcff';
  const trim = ally ? '#f5c542' : '#ff2e4d';
  const stone = ally ? '#8d93a3' : '#4e4b5a';
  const stoneD = ally ? '#6b7080' : '#363341';
  return svg(
    220,
    220,
    `
    <ellipse cx="110" cy="176" rx="100" ry="36" fill="${stoneD}" ${SW}/>
    <ellipse cx="110" cy="168" rx="96" ry="32" fill="${stone}" ${SW}/>
    <ellipse cx="110" cy="166" rx="70" ry="22" fill="${stoneD}"/>
    <path d="M44 166 L70 156 L96 170 M124 170 L150 156 L176 166" stroke="${trim}" stroke-width="2.5" fill="none" opacity=".9"/>
    <circle cx="70" cy="156" r="3" fill="${trim}"/><circle cx="150" cy="156" r="3" fill="${trim}"/>
    <!-- 기둥 -->
    <rect x="22" y="110" width="20" height="58" rx="3" fill="${stone}" ${SW}/>
    <rect x="178" y="110" width="20" height="58" rx="3" fill="${stone}" ${SW}/>
    <path d="M20 112 L44 112 M176 112 L200 112" stroke="${trim}" stroke-width="4"/>
    <circle cx="32" cy="100" r="8" fill="${core}" ${SW2}/><circle cx="188" cy="100" r="8" fill="${core}" ${SW2}/>
    <!-- 코어 -->
    <circle cx="110" cy="92" r="70" fill="${core}" opacity=".18"/>
    <circle cx="110" cy="92" r="52" fill="${core}" opacity=".22"/>
    <path d="M110 18 L148 70 L136 140 L110 160 L84 140 L72 70 Z" fill="${coreD}" ${SW}/>
    <path d="M110 18 L148 70 L110 82 L72 70 Z" fill="${core}"/>
    <path d="M110 82 L136 140 L110 160 Z" fill="${core}" opacity=".7"/>
    <path d="M110 18 L124 66 L110 82 Z" fill="${coreHi}" opacity=".6"/>
    <path d="M110 18 L148 70 L136 140 L110 160 L84 140 L72 70 Z" fill="none" ${SW}/>
    <circle cx="98" cy="54" r="5" fill="#fff" opacity=".9"/>
    <ellipse cx="110" cy="92" rx="72" ry="16" fill="none" stroke="${trim}" stroke-width="3" opacity=".8"/>
  `,
  );
}

export function firewallSvg() {
  return svg(
    70,
    100,
    `
    ${stoneBase(35, 60, 56, '#4e4b5a', '#363341')}
    <path d="M22 62 L26 18 L35 6 L44 18 L48 62 Z" fill="#1d1430" ${SW}/>
    <path d="M35 22 Q44 32 40 42 Q38 50 35 52 Q30 50 29 42 Q28 34 35 22 Z" fill="#ff6a2b"/>
    <path d="M35 32 Q40 38 38 44 Q36 48 35 48 Q32 46 32 42 Q32 38 35 32 Z" fill="#ffd166"/>
    <path d="M26 18 L44 18" stroke="#ff2e4d" stroke-width="2.5"/>
  `,
  );
}

/* ───────────── 기억(기록) 오브젝트 ───────────── */
export function memoryOrbSvg() {
  return svg(
    64,
    64,
    `
    <circle cx="32" cy="32" r="28" fill="#ffe28a" opacity=".22"/>
    <circle cx="32" cy="32" r="18" fill="#ffe9a8" ${SW2}/>
    <circle cx="32" cy="32" r="13" fill="#fff6d6"/>
    <path d="M32 20 L35 29 L44 32 L35 35 L32 44 L29 35 L20 32 L29 29 Z" fill="#f5c542"/>
    <circle cx="26" cy="25" r="3" fill="#fff"/>
  `,
  );
}

export function memoryBoxSvg() {
  return svg(
    72,
    64,
    `
    <ellipse cx="36" cy="30" rx="30" ry="22" fill="#00b7ff" opacity=".2"/>
    <rect x="10" y="30" width="52" height="28" rx="4" fill="#22305e" ${SW}/>
    <path d="M10 30 Q10 14 36 14 Q62 14 62 30 Z" fill="#2870ff" ${SW}/>
    <path d="M10 30 L62 30 M24 16 L24 58 M48 16 L48 58" stroke="#f5c542" stroke-width="3"/>
    <rect x="30" y="26" width="12" height="12" rx="2" fill="#f5c542" ${SW2}/>
    <circle cx="36" cy="32" r="2" fill="${O}"/>
    <path d="M36 4 L38 10 L44 12 L38 14 L36 20 L34 14 L28 12 L34 10 Z" fill="#bff0ff"/>
  `,
  );
}

export function memoryMonumentSvg() {
  return svg(
    72,
    100,
    `
    <ellipse cx="36" cy="40" rx="30" ry="34" fill="#ffe28a" opacity=".16"/>
    <rect x="10" y="80" width="52" height="14" rx="3" fill="#6b7080" ${SW}/>
    <path d="M18 82 L18 22 Q18 8 36 8 Q54 8 54 22 L54 82 Z" fill="#a3a9b8" ${SW}/>
    <rect x="24" y="30" width="24" height="30" rx="3" fill="#f5c542" ${SW2}/>
    <path d="M29 38 L43 38 M29 44 L43 44 M29 50 L39 50" stroke="#8a5a2b" stroke-width="2"/>
    <path d="M36 12 L38 18 L44 20 L38 22 L36 28 L34 22 L28 20 L34 18 Z" fill="#fff6d6"/>
  `,
  );
}

/* ───────────── HUD 아이콘 (HTML 용) ───────────── */
export const ICONS = {
  q: `<svg viewBox="0 0 48 48"><path d="M6 30 Q20 24 40 8" stroke="#bff0ff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M6 36 Q24 30 42 20" stroke="#00b7ff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M8 42 Q26 38 44 32" stroke="#bff0ff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M26 6 L34 6 L30 16 L38 16 L22 32 L26 20 L20 20 Z" fill="#ffe28a" stroke="#141826" stroke-width="2" stroke-linejoin="round"/></svg>`,
  w: `<svg viewBox="0 0 48 48"><path d="M24 4 L40 10 L39 26 Q36 38 24 44 Q12 38 9 26 L8 10 Z" fill="#2870ff" stroke="#bff0ff" stroke-width="3" stroke-linejoin="round"/><path d="M17 24 L22 29 L32 18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  r: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke="#ffe28a" stroke-width="2.5" stroke-dasharray="4 4"/><circle cx="14" cy="22" r="5" fill="#3d8bff" stroke="#141826" stroke-width="2"/><circle cx="24" cy="16" r="5" fill="#00b7ff" stroke="#141826" stroke-width="2"/><circle cx="34" cy="22" r="5" fill="#00DC84" stroke="#141826" stroke-width="2"/><path d="M8 36 Q14 28 20 36 M18 32 Q24 22 30 32 M28 36 Q34 28 40 36" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  pause: `<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>`,
  soundOn: `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8q3 4 0 8M18.5 5.5q5 6.5 0 13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  soundOff: `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  archive: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></svg>`,
  lock: `<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`,
  close: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  fullscreen: `<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`,
};

export function svgDataUrl(s: string) {
  // Phaser 로더는 base64 데이터 URI만 처리하므로 UTF-8 → base64 변환
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:image/svg+xml;base64,' + btoa(bin);
}
