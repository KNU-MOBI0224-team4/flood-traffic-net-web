/* ===== core: 3-fold aware data prep, constants, helpers =====
 * Ported from the design prototype's core.jsx. The prototype read the data from
 * a global `window.FLOOD` (injected by a <script> tag) and published helpers on
 * `window.CORE`. Here the data is a bundled JSON import and CORE is a real ES
 * module export. The data-shaping logic is otherwise unchanged.
 */
import FLOOD from './data/flood-all.json'

const D = FLOOD;
const MODEL_KEYS = D.models;       // 7 keys (display order from build)
const CONF = D.conf;               // ["TP","FP","FN","TN","nodata"]

const MODEL_META = {
  stgcn_k3_lnon:  { label: "STGCN K=3 +LN", desc: "그래프 시공간 GNN · 대표 모델", fam: "STGCN" },
  stgcn_k3_lnoff: { label: "STGCN K=3 −LN", desc: "K=3, LayerNorm 미사용",       fam: "STGCN" },
  stgcn_k2_lnon:  { label: "STGCN K=2 +LN", desc: "이웃 2홉 참조, LayerNorm",     fam: "STGCN" },
  stgcn_k2_lnoff: { label: "STGCN K=2 −LN", desc: "K=2, LayerNorm 미사용",       fam: "STGCN" },
  gru:            { label: "GRU",           desc: "노드별 시계열 · 그래프 미사용",  fam: "기타" },
  xgboost:        { label: "XGBoost",       desc: "트리 부스팅 베이스라인",         fam: "기타" },
  logistic:       { label: "Logistic",      desc: "단일시점 선형 베이스라인",       fam: "기타" },
};
const MODELS = MODEL_KEYS.map((k) => ({ key: k, ...MODEL_META[k] }));

// node lookup (shared across folds)
const nodeById = {};
for (const n of D.nodes) nodeById[n.node_idx] = n;

const FOLD_KEYS = Object.keys(D.folds); // fold1, fold2, fold3
const FOLD_LABEL = {};
for (const fk of FOLD_KEYS) FOLD_LABEL[fk] = String(D.folds[fk].year);

// ---- decode a fold lazily (cells columnar -> objects, timeline -> friendly) ----
const cache = {};
function getFold(fk) {
  if (cache[fk]) return cache[fk];
  const F = D.folds[fk];
  // timeline
  const timeline = F.timeline.map((p) => {
    const models = {};
    for (const m of MODEL_KEYS) {
      const a = p.m[m] || [0, 0, 0, 0];
      models[m] = { n_alarm: a[0], tp: a[1], fp: a[2], fn: a[3] };
    }
    return { t_idx: p.t, datetime: p.dt, n_onset: p.o, models };
  });
  const dtByT = {};
  for (const p of timeline) dtByT[p.t_idx] = p.datetime;

  // cells: row = [t,node,z, (s,a,c)*7]
  const cells = F.cells.map((r) => {
    const c = { t_idx: r[0], node_idx: r[1], z_true: r[2], datetime: dtByT[r[0]] };
    let i = 3;
    for (const m of MODEL_KEYS) {
      c[m + "_score"] = r[i]; c[m + "_alarm"] = r[i + 1]; c[m + "_conf"] = CONF[r[i + 2]];
      i += 3;
    }
    return c;
  });
  const cellsByT = {};
  for (const c of cells) (cellsByT[c.t_idx] ||= []).push(c);

  // events (date clusters by total onset)
  const byDate = {};
  for (let i = 0; i < timeline.length; i++) {
    const t = timeline[i], d = t.datetime.slice(0, 10);
    const e = (byDate[d] ||= { date: d, onset: 0, peakIdx: i, peak: -1 });
    e.onset += t.n_onset;
    if (t.n_onset > e.peak) { e.peak = t.n_onset; e.peakIdx = i; }
  }
  const events = Object.values(byDate).filter((e) => e.onset > 0).sort((a, b) => b.onset - a.onset);

  cache[fk] = {
    key: fk, year: F.year, highlight: F.highlight, tau: F.tau, counts: F.counts,
    metrics: F.metrics, timeline, cells, cellsByT, events, dtByT,
  };
  return cache[fk];
}

// ---- average metrics across folds (macro mean of P/R/F1; summed TP/FP/FN) ----
function avgMetrics() {
  const out = {};
  for (const m of MODEL_KEYS) {
    let P = 0, R = 0, F1 = 0, TP = 0, FP = 0, FN = 0, n = 0;
    for (const fk of FOLD_KEYS) {
      const mt = D.folds[fk].metrics[m];
      P += mt.P; R += mt.R; F1 += mt.F1; TP += mt.TP; FP += mt.FP; FN += mt.FN; n++;
    }
    out[m] = { P: P / n, R: R / n, F1: F1 / n, TP, FP, FN };
  }
  return out;
}
const AVG = avgMetrics();

// best model per fold + on average (by F1)
function bestByF1(metrics) {
  let best = null, v = -1;
  for (const m of MODEL_KEYS) if (metrics[m].F1 > v) { v = metrics[m].F1; best = m; }
  return best;
}
const BEST = {};
for (const fk of FOLD_KEYS) BEST[fk] = bestByF1(D.folds[fk].metrics);
BEST.avg = bestByF1(AVG);

const WK = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDate(s) {
  const [d, t] = s.split(" ");
  const [, mo, da] = d.split("-");
  const wk = WK[new Date(d + "T00:00:00").getDay()];
  return `${mo}/${da} (${wk}) ${t.slice(0, 5)}`;
}
function fmtDateShort(s) {
  const [d, t] = s.split(" ");
  const [, mo, da] = d.split("-");
  return `${mo}/${da} ${t.slice(0, 5)}`;
}

export const CORE = {
  D, MODELS, MODEL_KEYS, CONF, nodeById, FOLD_KEYS, FOLD_LABEL,
  getFold, AVG, BEST, fmtDate, fmtDateShort,
};