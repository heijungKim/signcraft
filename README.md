# 사인크래프트 — 간판·아크릴 현수막 견적 에디터

브라우저에서 직접 간판/아크릴 현수막을 디자인하고, **360° 3D 미리보기**로 재질감을 확인한 뒤,
**일러스트레이터에서 열리는 벡터(SVG) 파일**로 출력하고 제작을 요청할 수 있는 웹앱입니다.

## 실행 방법
`index.html`을 **더블클릭**하면 바로 열립니다. (별도 설치·빌드 불필요, 인터넷 연결 필요)

CDN(Fabric.js, Three.js, Google Fonts)을 사용하므로 최초 실행 시 온라인이어야 합니다.

## 주요 기능
- **에디터**: 텍스트/폰트/글자색/굵기, 사각형·원·선, 로고 이미지 업로드, 드래그로 위치·크기·회전
- **재질·크기**: 투명/유백/컬러/미러 아크릴, 스테인리스, 우드 · 두께 · 실제 mm 규격 반영
- **360° 미리보기**: 마우스 드래그 회전, 휠 확대/축소, 우클릭 이동 (재질별 반사·투명도 렌더링)
- **실시간 견적**: 면적×재질단가×두께×제품 배수 + 재단/LED 옵션 + 수량
- **벡터 출력**: `width/height`가 실제 mm 단위로 기록된 SVG → 일러스트에서 정확한 규격으로 열림 (PNG도 지원)
- **제작 요청**: 벡터(SVG) 원본 + 사양서(JSON) 동시 다운로드, 이메일 전송

## 파일 구조
```
index.html          레이아웃 + CDN 로드
css/styles.css      스타일
js/quote.js         견적 계산 (단가는 여기서 조정)
js/editor.js        2D 에디터 (Fabric.js) + SVG 출력
js/preview3d.js     360° 3D 미리보기 (Three.js)
js/exporter.js      파일 다운로드 / 제작 요청 패키지
js/app.js           전체 연결
```

## 커스터마이즈
- **단가 조정**: `js/quote.js`의 `MATERIAL_RATE`, `THICKNESS_MULT`, `PRODUCT_MULT`
- **폰트 추가**: `index.html`의 Google Fonts `<link>` + `#fontFamily` 옵션
- **재질 추가**: `js/quote.js`와 `js/preview3d.js`의 `materialParams`

## 참고 (벡터 출력 정확도)
- SVG의 텍스트는 **폰트 정보로** 저장됩니다. 인쇄소에서 동일 폰트가 없을 수 있으니
  최종 입고 전 일러스트레이터에서 **텍스트 → 윤곽선 만들기(Create Outlines)** 처리를 권장합니다.
- 실제 재단선/여백(bleed)이 필요하면 `js/exporter.js`의 `buildSVG`에서 추가하세요.
