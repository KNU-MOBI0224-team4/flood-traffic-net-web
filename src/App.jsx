/* ===== App ===== */
import React from 'react'
import { CORE } from './core.js'
import { MapView } from './components/MapView.jsx'
import { Timeline } from './components/Timeline.jsx'
import {
  Legend, ConsensusLegend, ConsensusPanel,
  ModelPicker, NowStats, CellDetail, ModelCompare,
} from './components/Panels.jsx'

const PALETTE = { tp: "#2dd4a7", fp: "#f5a524", fn: "#f2557e", truth: "#ffffff" };

// The prototype exposed two settings through a design-host "Tweaks" panel that
// only appears inside the claude.ai/design editor. In this standalone build that
// panel is gone, so its defaults are baked in: the map background defaults to
// "abstract" (still switchable via the on-map toggle) and the legend is shown.
const DEFAULT_MAP = "abstract";

function App() {
  const C = CORE;
  const palette = PALETTE;

  const [foldKey, setFoldKey] = React.useState(C.FOLD_KEYS[0]);
  const fold = React.useMemo(() => C.getFold(foldKey), [foldKey]);

  const [tIdx, setTIdx] = React.useState(() => fold.events.length ? fold.events[0].peakIdx : 0);
  const [model, setModel] = React.useState(fold.highlight);
  const [mapStyle, setMapStyle] = React.useState(DEFAULT_MAP);
  const [mapMode, setMapMode] = React.useState("single");
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(450);
  const [tab, setTab] = React.useState("now");
  const [selNode, setSelNode] = React.useState(null);
  const [fitNonce, setFitNonce] = React.useState(0);

  // fold switch → jump to its biggest event, reset transient state
  const switchFold = (fk) => {
    setPlaying(false);
    const f = C.getFold(fk);
    setFoldKey(fk);
    setTIdx(f.events.length ? f.events[0].peakIdx : 0);
    setSelNode(null);
  };

  React.useEffect(() => {
    if (!playing) return;
    const N = fold.timeline.length;
    const id = setInterval(() => setTIdx((i) => { if (i >= N - 1) { setPlaying(false); return i; } return i + 1; }), speed);
    return () => clearInterval(id);
  }, [playing, speed, fold.key]);

  const tp = fold.timeline[tIdx];
  const cells = (tp && fold.cellsByT[tp.t_idx]) || [];
  const counts = React.useMemo(() => {
    const o = { TP: 0, FP: 0, FN: 0, onset: 0 };
    for (const c of cells) {
      const cf = c[model + "_conf"];
      if (cf === "TP") o.TP++; else if (cf === "FP") o.FP++; else if (cf === "FN") o.FN++;
      if (c.z_true === 1) o.onset++;
    }
    return o;
  }, [foldKey, tIdx, model]);

  const selCell = selNode != null ? cells.find((c) => c.node_idx === selNode) : null;
  const jump = (idx) => { setPlaying(false); setTIdx(idx); setSelNode(null); setTimeout(() => setFitNonce((n) => n + 1), 60); };
  const modelLabel = C.MODELS.find((x) => x.key === model).label;

  return (
    <div className="app">
      <header className="hdr">
        <div className="mark"></div>
        <div>
          <h1>Flood Traffic Net — LA 고속도로 마비 조기경보</h1>
          <div className="sub">홍수 연동 통행 마비 발생(onset) 예측 · 약 1시간 선행 경보 · STGCN vs 베이스라인</div>
        </div>
        <div className="spacer"></div>
        <div className="fold-seg" title="Rolling 3-fold (과거 학습 → 미래 테스트)">
          {C.FOLD_KEYS.map((fk, i) => (
            <button key={fk} className={foldKey === fk ? "on" : ""} onClick={() => switchFold(fk)}>
              Fold <span className="yr">{i + 1}</span>
            </button>
          ))}
        </div>
        <span className="chip">발생 <b>{fold.counts.onset_cells}</b></span>
        <span className="chip">구간 <b>329</b></span>
      </header>

      <div className="body">
        <div className="mapwrap">
          <MapView fold={fold} tIdx={tIdx} model={model} mapMode={mapMode} mapStyle={mapStyle}
            palette={palette} selectedNode={selNode} onSelectNode={setSelNode} fitNonce={fitNonce} />

          <div className="map-tl">
            <div className="seg">
              {[["single", "단일 모델"], ["consensus", "모델 합의"]].map(([k, lbl]) => (
                <button key={k} className={mapMode === k ? "on" : ""} onClick={() => setMapMode(k)}>{lbl}</button>
              ))}
            </div>
            <div className="seg">
              {[["abstract", "추상"], ["dark", "다크 지도"], ["light", "밝은 지도"]].map(([k, lbl]) => (
                <button key={k} className={mapStyle === k ? "on" : ""} onClick={() => setMapStyle(k)}>{lbl}</button>
              ))}
            </div>
          </div>

          <div className="map-tr">
            <div className="timeread">
              <div className="d">{C.fmtDate(fold.timeline[tIdx].datetime)}</div>
              <div className="o">실제 발생 <b>{counts.onset}</b> 구간 · {mapMode === "consensus" ? "7개 모델 합의" : modelLabel}</div>
            </div>
            {mapMode === "consensus"
              ? <ConsensusLegend palette={palette} counts={counts} />
              : <Legend palette={palette} counts={counts} />}
          </div>
        </div>

        <div className="rail">
          <div className="tabs">
            <button className={tab === "now" ? "on" : ""} onClick={() => setTab("now")}>현재 시각</button>
            <button className={tab === "compare" ? "on" : ""} onClick={() => setTab("compare")}>모델 비교</button>
          </div>
          <div className="rail-scroll">
            {tab === "now" ? (
              mapMode === "consensus" ? (
                <>
                  <ConsensusPanel fold={fold} tIdx={tIdx} palette={palette} />
                  <CellDetail fold={fold} cell={selCell} palette={palette} />
                </>
              ) : (
                <>
                  <NowStats fold={fold} tIdx={tIdx} model={model} palette={palette} />
                  <ModelPicker fold={fold} model={model} setModel={setModel} />
                  <CellDetail fold={fold} cell={selCell} palette={palette} />
                </>
              )
            ) : (
              <ModelCompare model={model} setModel={setModel} />
            )}
          </div>
        </div>
      </div>

      <Timeline fold={fold} tIdx={tIdx} setTIdx={(i) => { setPlaying(false); setTIdx(i); }} model={model}
        palette={palette} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} onJump={jump} />
    </div>
  );
}

export default App;