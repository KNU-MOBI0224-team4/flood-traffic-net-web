# Flood Traffic Net — LA 고속도로 마비 조기경보

홍수로 인한 LA 광역권 고속도로 **마비 발생(onset)** 을 약 1시간 선행 예측하는 모델들의 결과를,
실제 정답(ground truth)과 함께 **지도 · 시간축 · 모델별 적중/오탐/미탐** 으로 보여주는 발표용
인터랙티브 대시보드입니다.

> 캘리포니아 교통국 District 7(LA + Ventura 카운티) 329개 고속도로 구간 · 시간당 1스텝 ·
> 7개 모델(STGCN 4계열 / GRU / XGBoost / Logistic) · Rolling 3-fold (2022 / 2023 / 2024 테스트).

이 저장소는 [Claude Design](https://claude.ai/design) 핸드오프 프로토타입(React + Babel-standalone,
CDN 로드)을 실제 운영 가능한 **Vite + React 18** 앱으로 이식한 것입니다. 화면 출력과 동작은
프로토타입과 동일하게 유지하면서, 빌드 시스템 · 의존성 · 모듈 구조만 실제 배포용으로 바꿨습니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 번들 → dist/
npm run preview  # 빌드 결과 미리보기
```

폰트(IBM Plex, 서브셋)와 데이터(`src/data/flood-all.json`)는 모두 번들에 포함되어 오프라인에서도
동작합니다. 외부 네트워크가 필요한 건 **'다크 지도'/'밝은 지도' 모드의 CARTO 지도 타일뿐**이고,
기본 '추상' 모드는 타일을 쓰지 않습니다.

## 배포 (GitHub Pages)

`main` 브랜치에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드 후 자동 배포합니다.

- **라이브 URL**: <https://knu-mobi0224-team4.github.io/flood-traffic-net-web/>
- **Pages 소스**: Settings → Pages → Source = **GitHub Actions** (REST API로 1회 활성화 완료)
- `vite.config.js`의 `base`가 `/flood-traffic-net-web/`라서 프로젝트 페이지 하위 경로에서도 에셋이 정상 로드됩니다.
- 코드를 고쳐 `main`에 푸시할 때마다 워크플로가 다시 돌아 사이트가 갱신됩니다(Actions 탭에서 진행 확인).

> 참고: 이 org에서는 워크플로 기본 `GITHUB_TOKEN`이 Pages 사이트를 *생성*할 권한이 없어
> (`Resource not accessible by integration`), Pages는 REST API로 한 번만 활성화했습니다.
> 그 이후의 빌드·배포는 전적으로 워크플로가 처리합니다.

## 주요 기능

- **지도 (Leaflet)** — 329개 구간을 실제 좌표로 표시. 배경: `추상`(타일 없는 다크) / `다크 지도` / `밝은 지도`.
  - **단일 모델 모드** — 점을 혼동행렬로 색 구분(적중 TP·오탐 FP·미탐 FN), 흰 링 = 실제 발생(GT).
    점을 클릭하면 우측에 그 구간의 7개 모델 예측(점수·τ·TP/FP/FN)을 한 번에 비교.
  - **모델 합의 모드** — 실제 발생 구간만 **7조각 도넛 글리프**로 표시(중앙 흰점 = GT,
    초록 조각 = 적중 모델, 붉은 조각 = 놓친 모델). 과반 적중이면 도넛이 조금 더 큼.
- **시간축 (실제 캘린더)** — 1~12월 달력 축 위에 발생 사건을 실제 시점에 배치. 막대는 실제 발생을
  **적중(초록)·미탐(빨강)** 으로 분리. 재생/일시정지/스텝/속도 조절. **발생 최다 Top 5** 칩으로 정확한 시각 점프.
- **우측 패널 — 현재 시각** — 단일 모드: TP/FP/FN 통계 + 모델 선택 + 구간 상세.
  합의 모드: 이 시각 모델별 적중 표(적중/발생 비율 · 오탐).
- **우측 패널 — 모델 비교** — fold × 모델 F1 매트릭스 + 평균(컬럼별 최고 강조) + 선택 모델 P/R/F1.
- **Fold 전환** — Fold 1/2/3 전환 시 해당 연도의 가장 큰 사건으로 자동 점프.

### 데이터가 말하는 핵심

희소 사건(전체의 0.01~0.08%)이라 절대 수치는 낮고, **fold마다 최고 모델이 다릅니다.**
대표 모델 STGCN K=3 +LN은 recall은 높지만 FP가 많아(precision↓), **평균 F1은 XGBoost(0.200)** 가
가장 견고합니다. 비교 탭에서 바로 확인할 수 있습니다.

## 데이터 모델

`src/data/flood-all.json` — 3개 fold를 컴팩트 컬럼 포맷으로 담은 자체 포함 번들(키 반복 제거).
`src/core.js`가 로드 시 객체 형태로 디코드합니다.

| 키 | 내용 |
|---|---|
| `nodes` | 329개 구간 메타(`node_idx`, `segment_id`, `lon`/`lat`, `route`, `length_m`, `direction`) |
| `models` | 7개 모델 키(표시 순서) |
| `conf` | 혼동행렬 라벨 인덱스 `["TP","FP","FN","TN","nodata"]` |
| `folds.{fold1,2,3}` | `year`, `highlight`(대표 모델), `tau`(모델별 경보 임계값), `counts`, `metrics`(P/R/F1/TP/FP/FN), `timeline`, `cells` |

- **timeline** 항목: `{ t, dt, o(=n_onset), m: { <model>: [n_alarm, tp, fp, fn] } }`
- **cells** 행(컬럼 배열): `[t_idx, node_idx, z_true, (score, alarm, conf_idx) × 7개 모델]`
  - `z_true=1` ⟺ 그 시각 그 구간에서 마비가 새로 시작(onset). 모델이 직접 예측하는 타깃.
  - `cells`는 "발생했거나 어떤 모델이든 경보한" 셀만 모은 경량 집합(TP/FP/FN 포함, 대부분의 TN 제외).

자세한 데이터 정의는 `docs/data-readme.md`(원본 데이터셋 README)를 참고하세요.

## 프로젝트 구조

```
index.html                  Vite 진입 HTML (#root, 모듈 엔트리)
vite.config.js              Vite + @vitejs/plugin-react (데이터 청크 분리)
scripts/
  subset_fonts.py           IBM Plex를 사용 글리프만 서브셋 → src/fonts/ 생성
src/
  main.jsx                  ReactDOM 루트 렌더 + Leaflet/폰트/스타일 import
  App.jsx                   상위 상태(fold/시각/모델/모드)와 레이아웃
  core.js                   데이터 디코드 · 상수 · 헬퍼 (CORE export)
  styles.css               디자인 시스템(다크 모노톤 + 데이터 의미색)
  fonts.css                 self-hosted @font-face 6종 (IBM Plex 서브셋)
  components/
    MapView.jsx             Leaflet 래퍼 (단일/합의 모드, 도넛 글리프)
    Timeline.jsx            실제 캘린더 시간축 + 재생 + Top 5 칩
    Panels.jsx             우측 레일 패널들(범례/통계/모델선택/상세/비교/합의표)
  data/
    flood-all.json         3-fold 데이터 번들
  fonts/                    서브셋 woff2 6종 (Sans KR 400/500/600/700 · Mono 400/500)
```

## 이식 노트 (프로토타입 → 운영 앱)

- **번들러** — Babel-standalone(브라우저 컴파일) + UMD CDN → **Vite + esbuild** 빌드.
- **모듈화** — `window.FLOOD`/`window.CORE`/`window.MapView` 전역 → ES 모듈 import/export.
- **데이터** — `<script>`로 주입하던 `window.FLOOD` → `flood-all.json` 정적 import(`core.js`).
- **Leaflet** — 프로토타입의 명령형 Leaflet 코드를 그대로 유지(react-leaflet 미사용)하여
  지도 동작을 1:1로 보존. `leaflet` npm 패키지 + CSS를 번들.
- **Tweaks 패널 제거** — 원본의 Tweaks 패널은 claude.ai/design 에디터 안에서만 나타나는
  디자인 호스트 도구이며 단독 배포 시에는 보이지 않습니다. 그 기본값(지도 배경 `추상`, 범례 표시)을
  코드에 그대로 반영했고, 지도 배경은 지도 위 토글로 계속 전환할 수 있습니다.
- **폰트 self-host** — Google Fonts CDN 링크 제거. `scripts/subset_fonts.py`로 IBM Plex Sans KR
  (400/500/600/700) + Mono(400/500)를 **앱이 실제 쓰는 글자만 서브셋**(총 ~319KB)해 `src/fonts/`에
  넣고 `src/fonts.css`의 `@font-face`로 로드합니다. 네트워크·OS와 무관하게 모든 뷰어가 동일한 글꼴을
  봅니다(외부 폰트 의존성 0). UI 문구를 바꾸면 스크립트를 다시 실행해 서브셋을 갱신하세요.

원본 디자인은 한국어 UI · 다크 모노톤(`#0a0c10`) + 데이터 의미에만 색을 쓰는 시스템
(적중 `#2dd4a7` · 오탐 `#f5a524` · 미탐 `#f2557e` · 실제발생 흰색)을 따릅니다.