/* ===== Panels: Legend, ConsensusLegend, ModelPicker, NowStats, CellDetail, ModelCompare ===== */
import React from 'react'
import { CORE } from '../core.js'

export function Legend({ palette, counts }) {
  const rows = [
    { k: "TP", c: palette.tp, label: "적중 (경보=실제)", n: counts.TP },
    { k: "FN", c: palette.fn, label: "미탐 (놓침)", n: counts.FN },
    { k: "FP", c: palette.fp, label: "오탐 (헛경보)", n: counts.FP },
  ];
  return (
    <div className="legend">
      <div className="lh">이 시각 · 선택 모델</div>
      {rows.map((r) => (
        <div className="lrow" key={r.k}>
          <span className="sw" style={{ background: r.c }}></span>
          <span>{r.label}</span><span className="cnt">{r.n}</span>
        </div>
      ))}
      <div className="lrow">
        <span className="sw ring"></span><span>실제 발생 구간</span><span className="cnt">{counts.onset}</span>
      </div>
    </div>
  );
}

export function ConsensusLegend({ palette, counts }) {
  const ringSvg = `<svg width="34" height="34" viewBox="0 0 34 34">` +
    [0,1,2,3,4,5,6].map((i)=>{
      const seg=(Math.PI*2)/7, g=0.12, a0=-Math.PI/2+i*seg+g/2, a1=-Math.PI/2+(i+1)*seg-g/2;
      const p=(r,a)=>[17+r*Math.cos(a),17+r*Math.sin(a)];
      const large=a1-a0>Math.PI?1:0; const[xo,yo]=p(14,a0),[x1,y1]=p(14,a1),[x2,y2]=p(9,a1),[x3,y3]=p(9,a0);
      const col=i<5?palette.tp:"#5a2436";
      return `<path d="M${xo} ${yo} A14 14 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A9 9 0 ${large} 0 ${x3} ${y3} Z" fill="${col}"/>`;
    }).join("")+`<circle cx="17" cy="17" r="7" fill="${palette.truth}"/></svg>`;
  return (
    <div className="cons-legend">
      <div className="lh">모델 합의 · 7개 모델 적중</div>
      <div className="cons-donut">
        <span dangerouslySetInnerHTML={{ __html: ringSvg }} />
        <div className="cons-key">
          <div><span className="dot" style={{ background: palette.truth }}></span>중앙 흰점 = 실제 발생(GT)</div>
          <div><span className="dot" style={{ background: palette.tp }}></span>초록 조각 = 적중한 모델</div>
          <div><span className="dot" style={{ background: "#5a2436" }}></span>붉은 조각 = 놓친 모델</div>
        </div>
      </div>
      <div className="note">조각 7개 = 7개 모델 · 발생 {counts.onset}곳 · 자세한 점수는 ‘단일 모델’에서</div>
    </div>
  );
}

export function ModelPicker({ fold, model, setModel }) {
  const C = CORE;
  return (
    <div className="block">
      <div className="sec-h">모델 선택 · {fold.year}</div>
      <div className="mp">
        {C.MODELS.map((m) => {
          const mt = fold.metrics[m.key];
          const on = m.key === model;
          const star = m.key === fold.highlight;
          return (
            <button key={m.key} className={"mp-item" + (on ? " on" : "")} onClick={() => setModel(m.key)}>
              <div>
                <div className="nm">{m.label} {star && <span className="star">대표</span>}</div>
                <div className="desc">{m.desc}</div>
              </div>
              <div className="f1"><span>F1</span>{mt.F1 ? mt.F1.toFixed(3) : "0.00"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NowStats({ fold, tIdx, model, palette }) {
  const C = CORE;
  const t = fold.timeline[tIdx];
  const mc = t.models[model] || { n_alarm: 0, tp: 0, fp: 0, fn: 0 };
  const total = mc.tp + mc.fp + mc.fn || 1;
  const seg = (n, c) => (n ? <i style={{ width: (n / total) * 100 + "%", background: c }} /> : null);
  return (
    <div className="block">
      <div className="sec-h">현재 시각</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 15, marginBottom: 14, color: "var(--ink)" }}>{C.fmtDate(t.datetime)}</div>
      <div className="stats">
        <div className="stat fn"><div className="v">{t.n_onset}</div><div className="k">실제 발생 (z=1)</div></div>
        <div className="stat tp"><div className="v">{mc.tp}</div><div className="k">적중 TP</div></div>
        <div className="stat fp"><div className="v">{mc.fp}</div><div className="k">오탐 FP</div></div>
        <div className="stat fn"><div className="v">{mc.fn}</div><div className="k">미탐 FN</div></div>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-3)" }}>경보 구성 (TP·FP·FN)</div>
      <div className="cbar">{seg(mc.tp, palette.tp)}{seg(mc.fp, palette.fp)}{seg(mc.fn, palette.fn)}</div>
    </div>
  );
}

export function CellDetail({ fold, cell, palette }) {
  const C = CORE;
  if (!cell) {
    return (
      <div className="block">
        <div className="sec-h">구간 상세 · 7개 모델</div>
        <div className="empty"><div className="ic">◎</div>지도에서 점을 클릭하면<br />이 시각·구간의 7개 모델 예측을<br />한 번에 비교합니다.</div>
      </div>
    );
  }
  const node = C.nodeById[cell.node_idx];
  const confC = (cf) => cf === "TP" ? palette.tp : cf === "FP" ? palette.fp : cf === "FN" ? palette.fn : "#39414f";
  const caught = C.MODEL_KEYS.filter((m) => cell[m + "_conf"] === "TP").length;
  const present = C.MODEL_KEYS.filter((m) => cell[m + "_conf"] !== "nodata").length;
  return (
    <div className="block">
      <div className="sec-h">구간 상세 · 7개 모델</div>
      <div className="cd-head">
        <span className="seg-id">{node.segment_id}</span>
        <span className="rt">{node.route ? "Route " + node.route : ""} {node.direction || ""}</span>
      </div>
      <div className="cd-meta">
        <span className={"tag " + (cell.z_true === 1 ? "onset" : "normal")}>{cell.z_true === 1 ? "● 실제 마비 발생" : "○ 발생 없음"}</span>
        <span className="tag normal">{C.fmtDateShort(cell.datetime)}</span>
        {cell.z_true === 1 && <span className="tag normal" style={{ color: "var(--ink-2)" }}>{caught}/{present} 모델 적중</span>}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--ink-3)", margin: "4px 0 10px" }}>발생확률 · 막대 끝의 세로선 τ는 모델별 경보 임계값</div>
      {C.MODELS.map((m) => {
        const sc = cell[m.key + "_score"], cf = cell[m.key + "_conf"], tau = fold.tau[m.key];
        const has = sc != null;
        const pct = has ? Math.min(100, Number(sc) * 100) : 0;
        return (
          <div className="score-row" key={m.key}>
            <span className={"nm" + (m.key === fold.highlight ? " hi" : "")}>{m.label}</span>
            <div className="score-track">
              {has && <div className="score-fill" style={{ width: pct + "%", background: confC(cf) }} />}
              <div className="score-tau" style={{ left: Math.min(100, tau * 100) + "%" }} />
            </div>
            <span className="val" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <span>{has ? Number(sc).toFixed(3) : "—"}</span>
              <span className={"conf-pill conf-" + cf}>{cf}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ModelCompare({ model, setModel }) {
  const C = CORE, D = C.D;
  const cols = [...C.FOLD_KEYS, "avg"];
  const metricsFor = (fk) => fk === "avg" ? C.AVG : D.folds[fk].metrics;
  const maxIn = {};
  for (const fk of cols) { const ms = metricsFor(fk); maxIn[fk] = Math.max(...C.MODEL_KEYS.map((m) => ms[m].F1)) || 1; }
  const bestAvg = C.BEST.avg;
  const bestLabel = C.MODELS.find((m) => m.key === bestAvg).label;
  const sel = C.MODELS.find((m) => m.key === model);

  return (
    <div className="block">
      <div className="sec-h">모델 성능 비교 · fold별 F1</div>
      <p style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.65, margin: "0 0 14px" }}>
        희소 사건이라 절대 수치는 낮습니다. <b style={{ color: "var(--ink-2)" }}>fold마다 최고 모델이 다르고</b>,
        평균 F1은 <b style={{ color: "var(--tp)" }}>{bestLabel}</b>가 가장 높습니다.
      </p>
      <table className="cmp-tbl">
        <thead>
          <tr>
            <th className="mh">모델</th>
            {cols.map((fk) => (
              <th key={fk}>{fk === "avg" ? "평균" : C.FOLD_LABEL[fk]}<span className="yl">{fk === "avg" ? "3-fold" : "test"}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {C.MODELS.map((m) => (
            <tr key={m.key} className={(m.key === model ? "on " : "") + (m.key === D.folds.fold1.highlight ? "hi" : "")}
              onClick={() => setModel(m.key)}>
              <td className="mn">{m.label}{m.key === D.folds.fold1.highlight && <span className="star" style={{ marginLeft: 6 }}>대표</span>}</td>
              {cols.map((fk) => {
                const v = metricsFor(fk)[m.key].F1;
                const best = (fk === "avg" ? C.BEST.avg : C.BEST[fk]) === m.key;
                return (
                  <td key={fk} className={"fcell" + (fk === "avg" ? " avg" : "") + (best ? " best" : "") + (v === 0 ? " zero" : "")}>
                    {v.toFixed(3)}
                    <span className="bm" style={{ width: (v / maxIn[fk]) * 100 + "%", background: best ? "var(--tp)" : undefined }}></span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cmp-detail">
        <div className="sec-h" style={{ marginBottom: 12 }}>{sel.label} · P/R/F1</div>
        {cols.map((fk) => {
          const mt = metricsFor(fk)[model];
          return (
            <div key={fk} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: fk === "avg" ? "var(--ink)" : "var(--ink-3)", marginBottom: 4, fontFamily: "var(--mono)" }}>
                {fk === "avg" ? "평균 (3-fold)" : C.FOLD_LABEL[fk] + " test"}
              </div>
              <div className="metric"><span className="ml">정밀도 P</span><div className="mt"><div className="mf" style={{ width: mt.P * 100 + "%", background: "var(--tp)" }} /></div><span className="mv">{mt.P.toFixed(3)}</span></div>
              <div className="metric"><span className="ml">재현율 R</span><div className="mt"><div className="mf" style={{ width: mt.R * 100 + "%", background: "#8b94a3" }} /></div><span className="mv">{mt.R.toFixed(3)}</span></div>
              <div className="metric"><span className="ml">F1</span><div className="mt"><div className="mf" style={{ width: mt.F1 * 100 + "%", background: "var(--fp)" }} /></div><span className="mv">{mt.F1.toFixed(3)}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConsensusPanel({ fold, tIdx, palette }) {
  const C = CORE;
  const t = fold.timeline[tIdx];
  const gt = t.n_onset;
  const rows = C.MODEL_KEYS.map((k) => {
    const mc = t.models[k] || { tp: 0, fp: 0, fn: 0 };
    return { k, label: C.MODELS.find((m) => m.key === k).label, tp: mc.tp, fp: mc.fp, fn: mc.fn };
  }).sort((a, b) => b.tp - a.tp || a.fp - b.fp);
  return (
    <div className="block">
      <div className="sec-h">이 시각 · 모델별 적중</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 14, marginBottom: 4, color: "var(--ink)" }}>{C.fmtDate(t.datetime)}</div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 14 }}>
        실제 발생 <b style={{ color: palette.fn, fontFamily: "var(--mono)" }}>{gt}</b> 구간 · 각 모델이 몇 개를 잡았나
      </div>
      {gt === 0 ? (
        <div className="empty" style={{ padding: "16px 0" }}>이 시각에는 실제 발생이 없습니다.</div>
      ) : (
        <div className="ctable">
          <div className="ctable-h">
            <span>모델</span><span className="r">적중 / 발생</span>
          </div>
          {rows.map((r, i) => {
            const rate = gt ? r.tp / gt : 0;
            const lead = i === 0 && r.tp > 0;
            return (
              <div className={"crow" + (lead ? " lead" : "")} key={r.k}>
                <span className="cl">{r.label}</span>
                <div className="cbar2">
                  <i style={{ width: rate * 100 + "%", background: palette.tp }} />
                </div>
                <span className="cv"><b style={{ color: r.tp ? palette.tp : "var(--ink-4)" }}>{r.tp}</b>/{gt}</span>
                <span className="cfp">{r.fp ? <span style={{ color: palette.fp }}>+{r.fp} 오탐</span> : ""}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 12, lineHeight: 1.5 }}>
        적중 막대 = 실제 발생 중 그 모델이 맞춘 비율 · 오탐은 발생이 없는데 울린 헛경보 수
      </div>
    </div>
  );
}