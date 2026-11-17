# SINDOH LEGENDS — THE LAST SUMMONER

부장님 퇴직 기념 모바일 웹게임. 부장님(GAME MASTER)이 추진팀·개발팀·사업팀과 함께 세 라인 중 하나를 돌파해
보안 위협(취약점 버그·피싱 메일·랜섬웨어)과 최종 보스 **ZERO DAY**를 물리치고 넥서스를 파괴하는 싱글플레이 MOBA형 미니게임입니다.
승리 후 직원 감사 영상이 공개됩니다.

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
→ VICTORY → 감사 메시지 열기

- 세 라인을 모두 밀 필요 없이 **한 라인만 돌파하면** 적 본진에 들어갈 수 있습니다.
- 사망 시 4초 후 본진에서 부활하며, 레벨과 파괴한 구조물은 유지됩니다.
- 새로고침해도 타이틀에서 **이어하기**로 진행 상황이 복구됩니다.

## 교체용 파일 위치

### 영상 — `public/config/media.json`

| id | 내용 | 기본 경로 | 해금 조건 |
|---|---|---|---|
| workshop_01 | 워크숍 영상 1 | `public/media/videos/workshop_01.mp4` | 아군 본진의 기록 상자 |
| workshop_02 | 워크숍 영상 2 | `public/media/videos/workshop_02.mp4` | 숲속의 기억 구슬 (탑-미드 사이 정글) |
| workshop_03 | 워크숍 영상 3 | `public/media/videos/workshop_03.mp4` | 강가의 기념비 (미드-바텀 사이 강) |
| esports | 사내 e스포츠 대회 | `public/media/videos/esports.mp4` | 첫 적 포탑 파괴 |
| thankyou | 직원 감사 영상 | `public/media/videos/thankyou.mp4` | 최종 승리 |

- 썸네일: `public/media/thumbs/<id>.jpg` (16:9)
- 파일이 없으면 플레이스홀더 화면이 표시되고 게임은 정상 진행됩니다.
- 영상은 기록을 열 때만 로딩됩니다(`preload="metadata"`).
- `public/media/videos/`, `public/media/thumbs/` 안의 파일은 `.gitignore` 처리되어 **저장소에 올라가지 않습니다.**
  접근 제한 호스팅(사내 스토리지·서명 URL 등)을 쓰려면 `media.json`의 `src`에 URL을 넣으세요.
- `media.json` 은 빌드 후 `dist/config/media.json` 으로 복사되므로 **빌드 없이 dist 안의 파일만 수정해도** 반영됩니다.
- 권장 인코딩: H.264 + AAC MP4, 720p, `-movflags +faststart` (iPhone 호환)

### 이미지·사운드 — `public/config/assets.json`

- `champion.name` : 챔피언 표시 이름 (기본 `GAME MASTER`)
- `images.championFace` : 부장님 얼굴 이미지(투명 배경 PNG, 정사각형, 원형으로 잘린 얼굴 권장).
  지정하면 내장 캐릭터의 얼굴 부분이 비워지고 그 자리에 얼굴 이미지가 합성됩니다.
- `images.champion_idle / champion_attack / champion_victory` : 챔피언 전신 이미지 통째 교체 (128:160 비율 PNG 권장)
- `images.minion_push / minion_dev / minion_biz / enemy_* / boss_zeroday / turret_* / inhibitor / nexus_* / firewall / memory_*`
- `audio.bgm / bgm_boss` : 배경음악 파일 (지정하지 않으면 합성 음악)
- `audio.voice_welcome / voice_summon / voice_victory` : 입장·궁극기·승리 음성 (없으면 텍스트 + 효과음)
- `audio.sfx_*` : 효과음 교체

경로가 틀리거나 파일이 없으면 자동으로 내장 그래픽/사운드를 사용합니다. 이미지 파일은 `public/assets/images/`,
오디오는 `public/assets/audio/` 에 두고 `assets/images/face.png` 처럼 적으면 됩니다.
(`public/assets/images/private_*` 이름의 파일은 저장소에 올라가지 않습니다.)

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
