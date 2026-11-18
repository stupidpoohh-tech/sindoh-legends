# 공개 범위 점검표 (PUBLIC / PRIVATE)

하나의 코드베이스에서 배포 설정(`EDITION`)으로 두 판을 만듭니다. 게임 로직·맵·전투·캐릭터는 공통이며,
판별로 달라지는 것은 아래 **판별 콘텐츠**와 **서버 설정**뿐입니다.

## 1. 판별 콘텐츠 — 빌드 시 한쪽만 포함

| 파일 | PUBLIC | PRIVATE |
|---|---|---|
| `content/public/content.json` | ✅ 포함 | — |
| `content/private/content.json` (영상 제목·설명, 감사 엔딩 문구) | — | ✅ 포함 |
| `src/ui/privateVideo.ts` (영상 API·입장 코드 클라이언트) | — (번들에서 제거) | ✅ |

`vite.config.ts` 의 `@content` 별칭이 `content/<EDITION>` 하나만 가리키므로, PUBLIC 빌드에는 PRIVATE 콘텐츠가 들어가지 않습니다.

## 2. 서버 전용 — 저장소·빌드 어디에도 값이 없음

| 항목 | 위치 | 비고 |
|---|---|---|
| 기념 영상 4개 | 비공개 R2 버킷 `sindoh-legends-videos` | 공개 URL(r2.dev) 비활성, PRIVATE 프로젝트에만 바인딩 |
| 영상 id ↔ R2 파일 이름 | PRIVATE 프로젝트 암호화 변수 `VIDEO_KEYS` | |
| 입장 코드 | PRIVATE 프로젝트 암호화 변수 `GIFT_CODE` | NFC 태그 주소에 포함 |
| 쿠키 서명 키 | PRIVATE 프로젝트 암호화 변수 `SESSION_SECRET` | |

## 3. 두 판에 모두 포함되는 자산 — 공개 여부 확인 필요

**실제 인물을 모델로 한 일러스트**
- 부장님: `public/assets/game/champ_*`, `title_champ`, `ui_portrait`, `title_full`, `diorama`, `public/icons/*`
- 세 팀장: `public/assets/game/cap_*`
- 원본: `art-src/` (부장님·팀장 스프라이트 시트, 시작 화면, 디오라마 사진)

**사내 정보**
- 회사명·로고 표기: 구조물·깃발·시작 화면의 `SINDOH`
- 조직명: 추진팀·개발팀·사업팀 (`src/config/captains.ts`, `src/world/mapData.ts`)

**제3자 음원**
- `public/assets/audio/` 의 BGM·아나운서 대사는 업로드한 원본(`art-src/audio/`)에서 추출한 것입니다.
  권리 관계를 확인하기 전까지 공개 배포에 포함할지 판단이 필요합니다.
  `public/config/assets.json` 의 `audio` 경로를 비우면 내장 합성 음원으로 대체됩니다.

> 저장소 자체가 공개 상태라면 위 3번 자산과 `content/private/content.json` 은 GitHub 에서 누구나 볼 수 있습니다.
> 영상·입장 코드·영상 파일 이름은 저장소에 없습니다.
