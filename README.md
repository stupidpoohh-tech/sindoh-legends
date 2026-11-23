# SINDOH LEGENDS — THE LAST SUMMONER

부장님 퇴직 기념 모바일 웹게임. 부장님(GAME MASTER)이 추진팀·개발팀·사업팀과 함께 세 라인 중 하나를 돌파해
보안 위협(취약점 버그·피싱 메일·랜섬웨어)과 최종 보스 **ZERO DAY**를 물리치고 넥서스를 파괴하는 싱글플레이 MOBA형 미니게임입니다.
승리 후 감사와 응원의 문구로 엔딩이 완결됩니다. 별도의 감사 영상은 필요하지 않습니다.

- Phaser 3 + TypeScript + Vite, 서버 없이 정적 호스팅으로 동작
- 모든 그래픽은 코드로 그린 오리지널 SVG/캔버스, 모든 사운드는 Web Audio 실시간 합성 (외부 자산 없음)
- iPhone Safari / Android Chrome / 데스크톱 브라우저 지원

## 실행

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`dist/` 폴더 전체를 HTTPS 정적 호스팅(GitHub Pages, Netlify, S3+CloudFront, 사내 웹서버 등)에 올리면 됩니다.
`base: './'` 로 빌드되므로 하위 경로(`https://example.com/sindoh/`)에서도 동작합니다.

## Cloudflare Pages 배포

### 방법 A. Git 연동 (권장)

Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git → 이 저장소 선택 후 아래처럼 설정합니다.

| 항목 | 값 |
|---|---|
| Framework preset | None (또는 Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (비워 둠) |
| 환경 변수 | `NODE_VERSION` = `22` (`.nvmrc`도 포함되어 있음) |

배포 주소는 `https://<프로젝트명>.pages.dev` 입니다. 커스텀 도메인은 프로젝트 → Custom domains 에서 연결합니다.
브랜치를 푸시할 때마다 자동 배포되며, 기본 브랜치가 아닌 브랜치는 미리보기 주소로 배포됩니다.

### 방법 B. 로컬에서 직접 업로드

```bash
npx wrangler login
```

```bash
npm run deploy
```

### 영상 호스팅 (중요)

Cloudflare Pages 는 **파일 하나당 25MiB 제한**이 있어 3분 분량 영상은 대부분 올라가지 않습니다.
또한 영상 폴더는 `.gitignore` 처리되어 Git 연동 배포에 포함되지 않습니다. 영상은 **Cloudflare R2** 에 올리고 URL 만 지정하세요.

1. R2 → 버킷 생성(예: `sindoh-media`) → 영상·썸네일 업로드
2. 버킷 Settings → Custom Domains 에서 `media.example.com` 같은 도메인 연결 (또는 개발용 `r2.dev` 공개 주소)
3. `public/config/media.json` 의 `src` / `poster` 를 전체 URL로 변경
   ```json
   "src": "https://media.example.com/workshop_01.mp4",
   "poster": "https://media.example.com/workshop_01.jpg"
   ```
4. 커밋·푸시하면 재배포됩니다. (`config/*` 는 `no-cache` 헤더라 바로 반영)

영상 주소를 추측하기 어렵게 하려면 파일명에 임의 문자열을 붙이세요(예: `workshop-7f3k9q.mp4`).
사이트 전체를 사내 인증(Cloudflare Access)으로 막을 수도 있지만, 그 경우 부장님 휴대폰에서도 로그인이 필요해 NFC로 바로 열리지 않습니다.

### NFC 태그

배포 후 최종 주소(예: `https://sindoh-legends.pages.dev/`)를 NFC 태그에 URI 레코드로 기록합니다.

## 팀장 NPC (아군 챔피언)

각 라인에 팀장 한 명이 미니언 부대와 함께 자동으로 싸웁니다. (부장님만 직접 조작)

| 팀장 | 라인 | 전투 | 패시브 (주변 300px, 부장님 포함 아군에만 적용) |
|---|---|---|---|
| 추진팀장 | TOP | 근접·방어 | 전방 지휘 — 받는 피해 20% 감소 |
| 개발팀장 | MID | 원거리 에너지탄 | 기술 지원 — 공격 속도 25% 증가 |
| 사업팀장 | BOT | 원거리 | 전략적 지원 — 포탑·구조물 대상 피해 30% 증가 |

- 쓰러지면 15초 후 본진에서 부활, HP 25% 이하면 아군 포탑으로 후퇴해 회복 후 복귀
- 부장님이 근처(650px)에 없으면 적 포탑 사거리 밖에서 대기 — 팀장 혼자 포탑을 밀어 게임이 끝나지 않음
- 부장님과 처음 만나면 인사 말풍선 (1회)
- 궁극기 R `전 부서 집결!`: 세 팀장(분신 연출)과 각 팀 대표 미니언이 부장님 곁에 순서대로 집결해 합동 공격 (약 3.6초)
- 이름·대사·집결 문구: `src/config/captains.ts` / 전투 수치·패시브 수치: `src/config/balance.ts` 의 `captains`

## 조작

| 동작 | 모바일 | 데스크톱 |
|---|---|---|
| 이동 | 화면 터치 / 누른 채 끌기 / 미니맵 터치 | 마우스 클릭 / 방향키 |
| 공격 대상 지정 | 적 터치 (사거리까지 이동 후 공격) | 적 클릭 |
| 자동 공격 | 멈춰 있을 때 근처 적 자동 공격 | 동일 |
| 스킬 | Q 긴급 대응 · W 보안 강화 · R 전 부서 집결 | Q / W(또는 E) / R 키 |
| 일시정지 | 우측 상단 버튼 | ESC |

## 게임 흐름

타이틀 → 입장 연출 → 튜토리얼(재플레이 시 건너뜀) → 라인 선택(TOP 추진팀 / MID 개발팀 / BOT 사업팀)
→ 적 포탑 파괴 → 억제기 파괴(보안 장벽 해제) → 적 본진 진입 → ZERO DAY 보스전
→ HP 40% 이하에서 "아군 지원 도착!" → 궁극기 **전 부서 집결!**로 마무리 → 넥서스 방화벽 2기 제거 → 넥서스 파괴(마지막 일격은 반드시 부장님)
→ VICTORY → 감사·응원 엔딩 → 타이틀 / 추억의 기록관 / 다시 플레이

- 세 라인을 모두 밀 필요 없이 **한 라인만 돌파하면** 적 본진에 들어갈 수 있습니다.
- 사망 시 4초 후 본진에서 부활하며, 레벨과 파괴한 구조물은 유지됩니다.
- 새로고침해도 타이틀에서 **이어하기**로 진행 상황이 복구됩니다.

## 교체용 파일 위치

### 영상 — 비공개 R2 + Pages Functions

영상은 GitHub·정적 빌드에 넣지 않고 **비공개 R2 버킷(`sindoh-legends-videos`, 바인딩 `VIDEOS`)** 에 둡니다.
선물(PRIVATE) 배포에서만 인증을 거친 사용자에게 `/api/video/<id>` 로 스트리밍합니다(HTTP Range·206 지원, `video/mp4`).

| 게임 id | R2 객체 키 (PRIVATE 프로젝트 변수 `VIDEO_KEYS`) | 해금 조건 |
|---|---|---|
| workshop_01 | (VIDEO_KEYS) | 아군 본진의 기록 상자 |
| workshop_02 | (VIDEO_KEYS) | 숲속의 기억 구슬 |
| workshop_03 | (VIDEO_KEYS) | 강가의 기념비 |
| esports | (VIDEO_KEYS) | 첫 적 포탑 파괴 |

- 제목·설명·해금 조건: `content/private/content.json`
- 파일 이름을 바꾸거나 새 영상을 올리면 PRIVATE 프로젝트의 `VIDEO_KEYS`(JSON) 만 고치고 재배포하면 됩니다.
- 일부 영상은 MP4 인덱스(moov)가 파일 끝에 있어 첫 로딩이 조금 느릴 수 있습니다.
  `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4` 로 변환해 다시 올리면 개선됩니다.

#### 배포 판 — 하나의 코드, 두 개의 Pages 프로젝트

| | PUBLIC (포트폴리오) | PRIVATE (부장님 선물) |
|---|---|---|
| Pages 프로젝트 | `sindoh-legends-portfolio` | `sindoh-legends` |
| 주소 | https://sindoh-legends-portfolio.pages.dev | https://sindoh-legends.pages.dev (NFC: `/?k=<입장코드>`) |
| 환경 변수 | 없음 (`EDITION` 미설정 = 공개판) | `EDITION=private`, 암호화: `GIFT_CODE`, `SESSION_SECRET`, `VIDEO_KEYS` |
| R2 바인딩 | 없음 | `VIDEOS` → `sindoh-legends-videos` |
| 접근 | 누구나 | 사이트 전체 잠금 — 입장 코드 확인 후 서명 쿠키(180일) |
| 기록관·엔딩 | 비공개 기념 콘텐츠 안내, 일반 엔딩 | 기념 영상 4개, 영상 없이 완결되는 감사 엔딩 |
| `/api/*` | 404 | 인증 시에만 동작 |

두 프로젝트 모두 같은 브랜치에 연결되어 푸시할 때마다 각각 빌드·배포됩니다.
로컬에서 판별로 빌드하려면 `npm run build`(PUBLIC) / `EDITION=private npm run build`(PRIVATE).
공개 범위 점검표는 `CONTENT_SCOPE.md` 를 참고하세요.

#### 인증 방식 (PRIVATE)

- `functions/_middleware.ts` 가 페이지·이미지·스크립트·API 를 포함한 **모든 요청**을 서버에서 검사합니다.
  쿠키가 없으면 입장 코드 화면(401)만 보입니다.
- NFC 주소 `/?k=<입장코드>` 로 접속하면 서버가 코드를 검증해 HttpOnly·Secure 쿠키를 발급하고 코드 없는 주소로 이동시킵니다.
- 영상 API 는 매 요청 쿠키 서명·만료를 다시 검증하고, R2 버킷은 공개 URL 없이 이 함수에서만 읽힙니다.
- 입장 코드를 바꾸려면 PRIVATE 프로젝트의 `GIFT_CODE` 를 바꾸고 재배포한 뒤 NFC 태그를 다시 쓰면 됩니다.
  `SESSION_SECRET` 을 바꾸면 기존에 발급된 쿠키가 모두 무효화됩니다.

### 일러스트·스프라이트 — `art-src/` → `public/assets/game/`

게임 그래픽은 `art-src/` 의 원본 일러스트·스프라이트 시트를 잘라 만든 WebP 스프라이트(약 115개, 2.3MB)입니다.

| 원본 | 사용처 |
|---|---|
| 부장님 마법사의 스프라이트 시트2 | 챔피언 대기·달리기(4)·공격(4)·피격·쓰러짐·승리 |
| download2 | 타이틀 화면 부장님 일러스트 |
| 신도 레전드 미니언 스프라이트 시트 | 추진팀(근접·원거리) / 개발팀(원거리·대포) / 사업팀(근접·복합기 포격), 대기·이동·공격·피격·귀환 |
| 네온 글리치 보스와 적 유닛 스프라이트 시트 | 취약점 버그·피싱 메일·랜섬웨어·ZERO DAY(대기·펀치·베기)·소환 포털·경고 표시 |
| 구조물1 / 구조물2 / 구조물3 / 구조물4 / download1 | 아군 포탑 / 적 포탑 / 억제기 / 적 넥서스 / 아군 넥서스 |
| 신도 레전드 구조물 스프라이트 시트 | 넥서스 방화벽, 파괴된 구조물(폐허) |
| 블루 골드 스킬 이펙트 시트 | Q 참격파, W 보호막, R 전 부서 집결 |
| 보랏빛 마법 충격파 폭발 / 붉은 번개 충격파 이펙트 | 적 구조물·보스 파괴 / 보스 광역 공격 |
| 아기자기한 판타지 초원 타일, download5, download3 | 맵 초원 타일, 소나무·바위 장식, 본진 깃발 |
| 판타지 게임 HUD UI 스프라이트 시트 | 초상화, 스킬 버튼, 일시정지·소리·설정 버튼, 금테 프레임 패널 |
| 신도 레전드 판타지 시작 화면 | 가로 화면 타이틀(버튼 위치에 터치 영역), 세로 화면 로고 |
| 삼각형 전장의 빛나는 미니맵 | 입장 연출 배경 |
| KakaoTalk_… (디오라마) | 추억의 기록관 상단 이미지 |
| 추진팀장 / 개발팀장 / 사업팀장 스프라이트 시트 | 팀장 NPC 대기·달리기·공격·피격·쓰러짐·부활·승리, 미니맵 아이콘, 패시브 엠블럼, 에너지탄 (흰 배경은 빌드 시 자동 투명화) |
| 신도 레전드 게임 디자인 보드-1 | 디자인 참고용 (게임에 직접 사용하지 않음) |

원본을 수정·교체했다면 아래 명령으로 다시 잘라냅니다. (필요: `pip install pillow numpy scipy`)

```bash
python3 tools/build_sprites.py
```

`art-src/` 는 배포 결과물(`dist/`)에 포함되지 않습니다.

### 배경음악·대사 — `public/assets/audio/`

원본(`art-src/audio/`)에서 소리만 추출해 사용합니다.

| 파일 | 원본 | 재생 시점 |
|---|---|---|
| bgm_title.mp3 | title.mp4 | 타이틀(첫 터치 후), 입장 연출 |
| bgm_login.mp3 | login.mp4 | 승리 화면 |
| bgm_game.mp3 | game bgm.mp4 | 게임 중(보스전 포함, 별도 보스 곡이 없으면 이어서 재생) |
| vo_*.mp3 (17개) | narratino.mp4 에서 필요한 대사만 잘라냄 | 아래 표 |

| 대사 | 상황 |
|---|---|
| 소환사의 협곡에 오신 것을 환영합니다 | 입장 연출 |
| 미니언들이 생성되었습니다 | 게임 시작 직후 |
| 퍼스트 블러드! | 부장님의 첫 처치 |
| 더블·트리플·쿼드라·펜타 킬! | 1.6초 안에 연속 처치 |
| 적을 처치했습니다 | 랜섬웨어 처치 |
| 적에게 당했습니다 / 아군이 당했습니다 | 부장님 사망 / 팀장 쓰러짐 |
| 전장의 화신 / 전설의 출현 | 레벨 2 / 레벨 3 |
| 포탑을 파괴했습니다 / 적의 억제기를 파괴했습니다 | 포탑·억제기 파괴 |
| 파랑 팀이 내셔 남작을 처치했습니다 | ZERO DAY 처치 |
| 마무리! / 승리! | 넥서스 최후의 일격 / 승리 화면 |

대사끼리는 겹치지 않으며(중요한 대사가 우선), 대사 중에는 배경음악 음량이 잠시 낮아집니다(iOS 제외).
파일 경로는 `public/config/assets.json` 의 `audio` 항목에서 바꿀 수 있고, `bgm_boss`·`bgm_victory` 를 채우면 보스전·승리 곡을 따로 지정할 수 있습니다.

### 개별 교체 — `public/config/assets.json`

- `champion.name` : 챔피언 표시 이름 (기본 `GAME MASTER`)
- `images.<키>` : 해당 스프라이트만 다른 파일로 교체 (키 목록은 파일 안에 있음, 예: `champ_idle`, `m_push_idle`, `boss_main`, `s_turret`)
- `audio.bgm / bgm_boss` : 배경음악 파일 (지정하지 않으면 합성 음악)
- `audio.voice_welcome / voice_summon / voice_victory` : 입장·궁극기·승리 음성 (없으면 텍스트 + 효과음)
- `audio.sfx_*` : 효과음 교체

경로가 틀리거나 파일이 없으면 자동으로 내장 대체 그래픽/합성 사운드를 사용합니다.

### 전투 수치 — `src/config/balance.ts`

플레이어 HP·이동속도·공격력·사거리, 미니언 생성 주기, 적 HP, 포탑·억제기·보스·넥서스 HP, 스킬 쿨타임, 경험치 등
모든 수치가 이 파일 한 곳에 있습니다. (수정 후 `npm run build` 필요)

### 서체

회사 서체 Freesentation을 사용합니다. `public/fonts/` 에 `Freesentation-5Medium.woff2`, `Freesentation-7Bold.woff2`,
`Freesentation-9Black.woff2` 를 넣으면 오프라인에서도 적용되고, 없으면 jsDelivr CDN → 시스템 서체 순으로 사용합니다.

## NFC 연결

NFC 태그에는 게임이 배포된 **HTTPS URL**을 NDEF URI 레코드로 기록합니다. (예: `https://example.com/sindoh-legends/`)
iPhone(XS 이후)과 Android 모두 잠금 해제 상태에서 태그를 대면 브라우저로 열립니다.
오디오는 브라우저 정책상 '협곡 입장' 버튼을 누른 뒤부터 재생됩니다.

## 파일 구조

```
public/config/media.json      영상 목록·경로·해금 조건
public/config/assets.json     이미지·사운드 교체, 챔피언 이름
public/media/videos|thumbs    영상·썸네일 (git 제외)
src/main.ts                   부트스트랩 (Phaser 생성, 화면 크기 대응)
src/config/balance.ts         전투 밸런스
src/config/runtime.ts         설정 JSON 로더
src/core/state.ts             게임 상태 머신 (TITLE … VIDEO)
src/core/save.ts              LocalStorage 저장 (손상 시 초기값)
src/core/events.ts            엔진 ↔ UI 이벤트 버스
src/world/mapData.ts          맵 기하(라인·정글·구조물·기억 위치)
src/world/grid.ts             이동 가능 격자 + A* 경로 탐색
src/systems/LaneManager.ts    웨이브 생성, 화면 밖 라인 경량 계산
src/entities/Unit.ts          전투 개체 공통 클래스
src/scenes/BootScene.ts       자산 레지스트리·로딩·대체 자산
src/scenes/GameScene.ts       전투·스킬·보스·진행·연출
src/art/svgs.ts               오리지널 캐릭터/구조물 SVG
src/art/mapPainter.ts         협곡 맵 캔버스 렌더링
src/audio/audio.ts            효과음·배경음 합성 및 파일 재생
src/ui/ui.ts, styles.css      타이틀·HUD·튜토리얼·일시정지·기록관·영상·승리 화면
```

### 게임대회 영상만 교체

PRIVATE 프로젝트에 `VIDEO_ESPORTS_KEY`를 설정하면 `esports` 항목에만 우선 적용됩니다. 기존 `VIDEO_KEYS`의 워크숍 매핑은 유지됩니다. 변경 후 재배포해야 적용됩니다.
기록관과 전체 이어보기는 게임대회 → 워크숍 1 → 워크숍 2 → 워크숍 3 순서이며, 이어보기는 해금된 영상만 포함합니다.
