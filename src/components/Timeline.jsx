/* ===== Timeline — real calendar axis ===== */
import React from 'react'
import { CORE } from '../core.js'

export function Timeline(props) {
  const { fold, tIdx, setTIdx, model, palette, playing, setPlaying, speed, setSpeed, onJump } = props;
  const C = CORE;
  const tl = fold.timeline;
  const N = tl.length;
  const W = 1000, H = 50;
  const wrapRef = React.useRef(null);

  const { timeMs, yearStart, span, maxOnset } = React.useMemo(() => {
    const ys = new Date(fold.year, 0, 1).getTime();
    const ye = new Date(fold.year + 1, 0, 1).getTime();
    const tm = tl.map((p) => new Date(p.datetime.replace(" ", "T")).getTime());
    return { timeMs: tm, yearStart: ys, span: ye - ys, maxOnset: Math.max(1, ...tl.map((t) => t.n_onset)) };
  }, [fold.key]);

  const xFrac = (i) => Math.max(0, Math.min(1, (timeMs[i] - yearStart) / span));
  const months = Array.from({ length: 12 }, (_, m) => ({ m, x: (new Date(fold.year, m, 1).getTime() - yearStart) / span }));

  const nearestIdx = (frac) => {
    const target = yearStart + frac * span;
    let best = 0, bd = Infinity;
    for (let i = 0; i < N; i++) { const d = Math.abs(timeMs[i] - target); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const handlePointer = (clientX) => {
    const r = wrapRef.current.getBoundingClientRect();
    setTIdx(nearestIdx(Math.max(0, Math.min(1, (clientX - r.left) / r.width))));
  };
  const [drag, setDrag] = React.useState(false);
  React.useEffect(() => {
    if (!drag) return;
    const mv = (e) => handlePointer(e.clientX);
    const up = () => setDrag(false);
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
  }, [drag]);

  const chips = React.useMemo(() => tl
    .map((p, i) => ({ i, dt: p.datetime, n: p.n_onset }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .sort((a, b) => a.i - b.i), [fold.key]);
  const cur = tl[tIdx];

  return (
    <div className="foot">
      <div className="foot-top">
        <button className="step" onClick={() => setTIdx(Math.max(0, tIdx - 1))} title="이전">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button className="play" onClick={() => setPlaying(!playing)} title={playing ? "일시정지" : "재생"}>
          {playing
            ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>}
        </button>
        <button className="step" onClick={() => setTIdx(Math.min(N - 1, tIdx + 1))} title="다음">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>

        <div className="foot-meta">
          <span className="bigdate">{cur.datetime.slice(0, 16)}</span>
          <span style={{ color: "var(--ink-4)" }}>활동 {tIdx + 1}/{N}</span>
          <span className="speed">속도
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              <option value={900}>0.5×</option><option value={450}>1×</option>
              <option value={220}>2×</option><option value={110}>4×</option>
            </select>
          </span>
        </div>

        <div className="evchips">
          <span style={{ fontSize: 10.5, color: "var(--ink-4)", alignSelf: "center", marginRight: 2 }}>발생 최다 Top 5</span>
          {chips.map((c) => (
            <button key={c.i} className={"evchip" + (c.i === tIdx ? " on" : "")} onClick={() => onJump(c.i)} title={c.dt}>
              {c.dt.slice(5, 16).replace("-", "/")} <span className="n">{c.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tl" ref={wrapRef}
        onPointerDown={(e) => { setDrag(true); handlePointer(e.clientX); }}>
        <svg className="tl-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {months.map((mo) => (
            <line key={mo.m} x1={mo.x * W} y1="0" x2={mo.x * W} y2={H - 12}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" y1={H - 12.5} x2={W} y2={H - 12.5} stroke="rgba(255,255,255,0.1)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {tl.map((t, i) => {
            const mc = t.models[model] || { tp: 0, fp: 0, fn: 0 };
            if (t.n_onset === 0 && mc.fp === 0) return null;
            const x = xFrac(i) * W;
            const tpH = (mc.tp / maxOnset) * (H - 16);
            const fnH = (mc.fn / maxOnset) * (H - 16);
            const onsetH = (t.n_onset / maxOnset) * (H - 16);
            const base = H - 12.5;
            return (
              <g key={i}>
                {t.n_onset > 0 && (
                  <>
                    <rect x={x - 0.9} y={base - onsetH} width="1.8" height={fnH} fill={palette.fn} opacity="0.92" />
                    <rect x={x - 0.9} y={base - tpH} width="1.8" height={tpH} fill={palette.tp} opacity="0.95" />
                  </>
                )}
                {t.n_onset === 0 && mc.fp > 0 && (
                  <rect x={x - 0.7} y={base} width="1.4" height="3" fill={palette.fp} opacity="0.5" />
                )}
              </g>
            );
          })}
        </svg>
        <div className="month-labels">
          {months.map((mo) => (
            <span key={mo.m} style={{ left: mo.x * 100 + "%" }}>{mo.m + 1}월</span>
          ))}
        </div>
        <div className="tl-cursor" style={{ left: xFrac(tIdx) * 100 + "%" }}></div>
      </div>
    </div>
  );
}