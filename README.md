# 용용이게임 (모바일 웹)

## 실행 주소
GitHub Pages를 켜면 아래 주소로 실행됩니다.

- https://<사용자명>.github.io/<저장소명>/

예) 저장소가 `bum1721/gigt-game` 이면:
- https://bum1721.github.io/gigt-game/

## 업로드 파일 구조(중요)
저장소 **루트(최상단)** 에 아래처럼 있어야 합니다.

- index.html
- style.css
- game.js
- assets/
  - character.png
  - gift.png
  - bomb.png

⚠️ `assets` 폴더/파일이 빠지거나, 파일명이 다르면 캐릭터/이미지가 안 뜹니다.

## GitHub Pages 설정
Settings → Pages → Build and deployment
- Source: Deploy from a branch
- Branch: main
- Folder: /(root)

저장 후 1~3분 기다리면 URL이 뜹니다.

## 안될 때(캐시/경로)
- 아이폰에서 주소를 다시 열고 새로고침
- 캐시가 의심되면 주소 뒤에 `?v=2` 붙여 열기
  - 예: https://bum1721.github.io/gigt-game/?v=2
- 저장소에 `assets/character.png`가 **실제로** 올라갔는지 확인
