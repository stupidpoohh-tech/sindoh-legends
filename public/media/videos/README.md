# 영상 파일 위치

이 폴더에 아래 이름으로 영상을 넣으면 게임에서 바로 재생됩니다. (파일명은 `public/config/media.json`에서 변경 가능)

- workshop_01.mp4 / workshop_02.mp4 / workshop_03.mp4
- esports.mp4
- thankyou.mp4

이 폴더의 영상 파일은 `.gitignore`로 저장소에 올라가지 않습니다(직원 얼굴 보호).
접근 제한이 있는 호스팅(사내 스토리지, 서명 URL 등)을 쓸 경우 `media.json`의 `src`에 URL을 넣으세요.
권장 형식: H.264 + AAC MP4 (iPhone Safari 호환), 720p 이하, `faststart` 적용.
