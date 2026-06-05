# Flood Traffic Net — Case Study 시각화 데이터

홍수로 인한 **도로 마비 발생(onset)** 예측 모델들의 결과를, 실제 정답(ground truth)과
함께 (시각 × 도로구간) 단위로 정리한 **웹 시각화용 데이터셋**입니다. 지도 + 시간축 +
모델별 적중/오탐/미탐을 그릴 수 있도록 구성돼 있습니다.

---

## 1. 무엇을 예측하는가

- **대상 지역**: D7 권역 도로망 — **329개 도로 구간(노드)**, 시간당 1스텝.
  - 좌표는 WGS84 경위도(`lon`/`lat`)이며 실제 좌표라 실지도(예: Leaflet/Mapbox) 위에 그대로 표시 가능합니다.

### 데이터 지역(어디인가)

미국 **캘리포니아주 로스앤젤레스(LA) 대도시권의 주요 고속도로망**입니다.

- **행정 구분**: Caltrans(캘리포니아 교통국) **District 7 (D7)** — 행정상 **로스앤젤레스 카운티
  + 벤투라 카운티**를 담당하는 권역입니다. 본 데이터 329개 구간의 소속은 LA 카운티 306개,
  Ventura(VEN) 카운티 23개입니다.
- **공간 범위(대략)**: 경도 `-119.01 ~ -117.70`, 위도 `33.75 ~ 34.47`.
  중심은 약 **(위도 34.08, 경도 -118.26)** 로 다운타운 LA 인근입니다. 동서로 벤투라/샌퍼낸도
  밸리에서 샌버나디노 카운티 경계까지, 남북으로 사우스베이 해안에서 산악 구간까지 걸칩니다.
- **포함 노선(주요 프리웨이)**: I-5, US-101, I-405, I-10, I-210, SR-60, SR-118, SR-110,
  I-605, I-710, SR-134, I-105 등 — LA 권역을 대표하는 간선 고속도로들입니다.
- 즉 이 데이터의 "도로 마비"는 **LA 광역권 고속도로 구간**에서 강우와 연동된 통행 속도 급락
  (정체/마비) 사건을 의미합니다.
- **두 가지 라벨**
  - `y` (**상태**, state): 그 시각 그 구간이 **마비 상태인가** (1=마비 지속 중).
  - `z` (**발생**, onset): 그 시각이 **마비가 새로 시작되는 직전인가**.
    - 정의: `z[t]=1 ⟺ y[t]=0 (아직 정상) 이고 y[t+1]=1 (다음 시각 마비 진입)`.
    - 즉 z는 "마비가 켜지는 스위치"이고, **모델이 직접 예측하는 타깃은 z**입니다.
- **예측 설정 (모든 모델 공통)**: `seq_len=12`, `pred_horizon=0`.
  - 직전 12시간 + 현재 시각(t)까지의 관측으로 `z[t]`를 예측 → 실제 마비는 t+1에 나타나므로
    **약 1시간 선행 경보**에 해당합니다.
- **희소성 주의**: 마비 발생은 전체 (시각×구간)의 **약 0.01~0.08%**로 극히 드뭅니다.
  그래서 절대 지표 값이 낮고, 정답이 있는 셀이 매우 적습니다 (시각화 시 색/크기 강조 필요).

---

## 2. 어떤 실험을 했는가

동일한 데이터·전처리·평가 프로토콜에서 **4개 모델 계열**을 공정 비교했습니다.

| 모델 키 | 설명 |
|---|---|
| `logistic` | Logistic Regression (단일 시점 특성, 기본 베이스라인) |
| `xgboost` | XGBoost (트리 부스팅, 강력한 베이스라인) |
| `gru` | GRU (노드별 12시간 시계열, 그래프 구조 미사용) |
| `stgcn_k2_lnon` | STGCN, Chebyshev K=2, LayerNorm 사용 |
| `stgcn_k2_lnoff` | STGCN, K=2, LayerNorm 미사용 |
| `stgcn_k3_lnon` | STGCN, K=3, LayerNorm 사용 — **대표 모델(highlight)** |
| `stgcn_k3_lnoff` | STGCN, K=3, LayerNorm 미사용 |

- STGCN은 도로망 그래프(인접 구간 정보)를 쓰는 시공간 GNN이고, K는 한 번에 참조하는 이웃 홉
  수, LayerNorm은 정규화 옵션입니다.
- **time-feature(시간 주기성) 실험은 STGCN에만** 적용 가능하여, 본 case study는 **time-feature
  OFF 버전**만 포함합니다 (GRU/XGBoost/Logistic은 time-feature 미지원).

### 평가 프로토콜
- **Rolling 3-fold (시간순)**: 과거로 학습 → 미래로 검증/테스트.
  - `fold_1`: train 2016–2020 / val 2021 / **test 2022**
  - `fold_2`: train 2016–2021 / val 2022 / **test 2023**
  - `fold_3`: train 2016–2022 / val 2023 / **test 2024**
- **임계값 분위**: `p97` (강우 97 percentile 기준 라벨).
- **경보 임계값 τ**: 각 모델마다 검증셋에서 `precision ≥ 0.10`을 만족하는 값으로 선택 → 테스트에 적용.
  fold·모델별 τ는 각 `meta.json`에 기록돼 있습니다.
- 본 데이터는 **테스트 기간 전체**(각 fold의 해당 연도)를 담습니다.

---

## 3. 폴더 구조

```
case_study/
  README.md                  ← (이 파일)
  nodes.json                 ← 도로구간 메타+좌표 (fold 공통, 1개)
  <fold>/
    meta.json                ← fold 정보·모델 목록·τ·카운트
    cells_focus.json         ← [웹 핵심] 정답 발생 ∪ 임의 모델 경보 셀
    timeline.json            ← 시각별 집계 (타임슬라이더/개요용)
    cells_full.csv.gz        ← 테스트 전체 평가 셀 (오프라인 풀, 대용량)
```
`<fold>` = `fold_1_train2016_2020_val2021_test2022` 등 3개.

---

## 4. 파일별 상세 스키마

### 4.1 `nodes.json` — 도로구간(노드) 메타
객체 배열. `node_idx`로 다른 파일의 셀과 join합니다.

| 필드 | 타입 | 의미 |
|---|---|---|
| `node_idx` | int | 노드 인덱스 (0~328). **join 키** |
| `segment_id` | str | 도로구간 ID (예: `D7_RS000123`) |
| `lon`, `lat` | float \| null | 구간 중심점 경위도(WGS84) |
| `route` | str \| null | 노선 번호 |
| `length_m` | float \| null | 구간 길이(m) |
| `direction` | str \| null | 방향 |

> 주의: 좌표는 **구간 중심점(centroid)** 입니다. 실제 도로 선(line) 형상 데이터는 포함되지 않습니다.

### 4.2 `cells_focus.json` — [웹 시각화 핵심]
"정답이 발생(`z_true=1`)했거나, 어떤 모델이든 경보(alarm)한" 셀만 모은 경량 데이터.
**TP/FP/FN이 모두 여기 들어있어** 오탐·미탐 스토리를 그릴 수 있습니다. (대부분의 "아무 일도
없던" 셀(TN)은 제외해 가볍게 만듦.)

객체 배열, 각 셀:

| 필드 | 타입 | 의미 |
|---|---|---|
| `t_idx` | int | 시각 인덱스 |
| `datetime` | str | 사람이 읽는 시각 `"YYYY-MM-DD HH:MM:SS"` |
| `node_idx` | int | 노드 인덱스 (→ `nodes.json` join) |
| `y_true` | int(0/1) | 그 시각 실제 **마비 상태** |
| `z_true` | int(0/1) | 그 시각 실제 **마비 발생(정답 타깃)** |
| `z_mask` | int(0/1) | 1이면 예측 대상 셀(현재 정상이라 발생 가능) |
| `<model>_score` | float \| "" | 모델의 발생 확률(0~1). 예측 없으면 `""` |
| `<model>_alarm` | int(0/1) \| "" | `score ≥ τ` 경보 여부. 예측 없으면 `""` |
| `<model>_conf` | str | 혼동행렬 라벨 (아래 참고) |

`<model>`은 7개: `stgcn_k2_lnon, stgcn_k2_lnoff, stgcn_k3_lnon, stgcn_k3_lnoff, gru, xgboost, logistic`.
→ 셀 하나당 컬럼 `7 × 3(score/alarm/conf)` 개.

**`<model>_conf` (혼동행렬) 값**
| 값 | 의미 |
|---|---|
| `TP` | 발생(z=1) + 경보 → 적중 |
| `FP` | 정상(z=0) + 경보 → 오탐(헛경보) |
| `FN` | 발생(z=1) + 무경보 → 미탐(놓침) |
| `TN` | 정상(z=0) + 무경보 → 정상 |
| `nodata` | 그 셀에 모델 예측이 없음(결측 입력 등) |

### 4.3 `timeline.json` — 시각별 집계
시간 슬라이더·요약 그래프용. 활동이 있는(발생 또는 경보) 시각만 포함.

| 필드 | 타입 | 의미 |
|---|---|---|
| `t_idx` | int | 시각 인덱스 |
| `datetime` | str | 시각 |
| `n_onset` | int | 그 시각 실제 발생(z=1) 구간 수 |
| `<model>` | object | `{ n_alarm, tp, fp, fn }` 그 시각 모델별 카운트 |

### 4.4 `meta.json` — fold 메타
| 필드 | 의미 |
|---|---|
| `fold`, `percentile` | fold 이름, 임계 분위(p97) |
| `highlight_model` | 대표 모델 키 (`stgcn_k3_lnon`) |
| `models`, `models_present` | 전체/실제 존재 모델 키 목록 |
| `tau` | 모델별 경보 임계값 τ (alarm 재계산에 사용) |
| `counts` | `test_timestamps`, `universe_cells`, `focus_cells`, `onset_cells`, `timeline_points` |
| `confusion_legend` | TP/FP/FN/TN/nodata 정의 |

### 4.5 `cells_full.csv.gz` — 전체 평가 셀 (오프라인용)
`cells_focus.json`과 **동일한 컬럼**의 gzip CSV이지만, 테스트 기간의 **모든 평가 셀**(TN 포함,
fold당 약 280만 행)을 담습니다. 브라우저로 직접 로드하기엔 큽니다 → 분석/재집계용. 웹에는
`cells_focus.json`을 쓰세요.

---

## 5. 파일 간 연결(join) 및 활용 정보

시각화 구성(레이아웃·색·인터랙션 등 디자인)은 웹팀에서 결정합니다. 여기서는 데이터가 서로
어떻게 연결되고 무엇을 보여줄 수 있는지(정보)만 정리합니다.

- **공간 연결**: 셀의 `node_idx` → `nodes.json`의 동일 `node_idx` → `lon`/`lat`/`route`/`length_m`.
- **시간 연결**: 셀의 `t_idx`(또는 `datetime`)가 같은 시각의 `timeline.json` 항목과 1:1 대응.
- **모델 선택**: 한 셀에 7개 모델 각각의 `score`/`alarm`/`conf`가 들어 있어, 모델을 골라
  같은 시각·구간에서 비교할 수 있습니다. 대표 모델 키는 `meta.json`의 `highlight_model`.

**제공되는 정보 요약**
- 셀 단위(`cells_focus.json` / `cells_full.csv.gz`): 실제 발생 `z_true`·상태 `y_true`·예측대상
  여부 `z_mask`, 모델별 예측확률 `score`·경보 `alarm`·적중/오탐/미탐 분류 `conf`.
- 시각 단위(`timeline.json`): 실제 발생 구간 수 `n_onset`, 모델별 경보 수와 TP/FP/FN.
- 노드 단위(`nodes.json`): 좌표·노선·길이 등 구간 메타.

**데이터 특성 참고**: 발생(z=1) 셀은 매우 드뭅니다(각 fold `meta.json`의 `counts` 참조).
`cells_focus.json`은 "발생했거나 어떤 모델이 경보한" 셀만 모은 것이라 의미 있는 셀만 포함합니다.
`timeline.json`의 `n_onset`이 큰 시각은 실제로 다수 구간이 동시에 마비된 사건에 해당합니다.

---

## 6. 알아둘 점 / 한계

- **좌표는 중심점만** — 실제 도로 라인 형상 없음(점 표현 권장).
- **`time-feature OFF` 버전만** 포함 (STGCN만 시간특성 지원하므로 비교 일관성 위해 OFF 고정).
- **예측 없음(`nodata`)** — 입력 12시간 중 결측이 있으면 일부 모델은 그 셀을 예측하지 못합니다.
  모델마다 예측 가능한 셀 집합이 조금씩 다를 수 있습니다(필드가 `""`/`nodata`).
- **τ는 fold·모델마다 다름** — 경보 기준선이 모델별로 다르니, 점수 비교 시 각 `meta.json`의
  `tau`를 함께 표시하면 공정합니다.
- 절대 성능은 낮습니다(희소 사건) — 모델 우열보다 **케이스별 대응 양상**을 보여주는 데 초점.
