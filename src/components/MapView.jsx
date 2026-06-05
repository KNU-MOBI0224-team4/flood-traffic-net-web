/* ===== MapView — Leaflet wrapper. single = per-model detail, consensus = GT + 7-model donut ===== */
import React from 'react'
import L from 'leaflet'
import { CORE } from '../core.js'

function arcPath(cx, cy, rIn, rOut, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0o, y0o] = p(rOut, a0), [x1o, y1o] = p(rOut, a1);
  const [x1i, y1i] = p(rIn, a1), [x0i, y0i] = p(rIn, a0);
  return `M${x0o.toFixed(2)} ${y0o.toFixed(2)} A${rOut} ${rOut} 0 ${large} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)} ` +
    `L${x1i.toFixed(2)} ${y1i.toFixed(2)} A${rIn} ${rIn} 0 ${large} 0 ${x0i.toFixed(2)} ${y0i.toFixed(2)} Z`;
}
function donutSVG(states, pal, big) {
  const n = states.length, S = big ? 30 : 24, c = S / 2;
  const rOut = big ? 13 : 10, rIn = big ? 8 : 6, gap = 0.12;
  const seg = (Math.PI * 2) / n;
  let arcs = "";
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * seg + gap / 2, a1 = -Math.PI / 2 + (i + 1) * seg - gap / 2;
    const col = states[i] === "hit" ? pal.tp : states[i] === "miss" ? "#5a2436" : "#262c36";
    arcs += `<path d="${arcPath(c, c, rIn, rOut, a0, a1)}" fill="${col}"/>`;
  }
  return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${arcs}` +
    `<circle cx="${c}" cy="${c}" r="${rIn - 1.5}" fill="${pal.truth}"/></svg>`;
}

export function MapView(props) {
  const { fold, tIdx, model, mapMode, mapStyle, palette, selectedNode, onSelectNode, fitNonce } = props;
  const C = CORE;
  const elRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const tilesRef = React.useRef({});
  const markersRef = React.useRef({});
  const ringRef = React.useRef(null);
  const donutRef = React.useRef(null);
  const selRef = React.useRef(null);
  const onSelRef = React.useRef(onSelectNode);
  React.useEffect(() => { onSelRef.current = onSelectNode; }, [onSelectNode]);

  const confColor = (cf) => cf === "TP" ? palette.tp : cf === "FP" ? palette.fp : cf === "FN" ? palette.fn : cf === "TN" ? "#39414f" : "#2a3140";

  React.useEffect(() => {
    const map = L.map(elRef.current, { center: [34.05, -118.28], zoom: 9, zoomControl: false, zoomSnap: 0.25 });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    tilesRef.current.dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19, subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO" });
    tilesRef.current.light = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19, subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO" });

    const grp = L.layerGroup().addTo(map);
    for (const n of C.D.nodes) {
      if (n.lon == null || n.lat == null) continue;
      const m = L.circleMarker([n.lat, n.lon], { radius: 2.5, weight: 0, fillColor: "#39414f", fillOpacity: 0.5 });
      m.on("click", () => onSelRef.current(n.node_idx));
      m.addTo(grp);
      markersRef.current[n.node_idx] = m;
    }
    ringRef.current = L.layerGroup().addTo(map);
    donutRef.current = L.layerGroup().addTo(map);
    selRef.current = L.layerGroup().addTo(map);
    const lats = C.D.nodes.filter((n) => n.lat != null).map((n) => n.lat);
    const lons = C.D.nodes.filter((n) => n.lon != null).map((n) => n.lon);
    map.fitBounds([[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]], { padding: [60, 60] });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  React.useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const t = tilesRef.current;
    map.removeLayer(t.dark); map.removeLayer(t.light);
    if (mapStyle === "dark") t.dark.addTo(map);
    else if (mapStyle === "light") t.light.addTo(map);
  }, [mapStyle]);

  React.useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const tp = fold.timeline[tIdx];
    const cells = (tp && fold.cellsByT[tp.t_idx]) || [];
    const byNode = {};
    for (const c of cells) byNode[c.node_idx] = c;
    ringRef.current.clearLayers();
    donutRef.current.clearLayers();

    if (mapMode === "consensus") {
      // every cell node faint; GT nodes shown as 7-model donuts
      for (const [idx, m] of Object.entries(markersRef.current)) {
        if (m.getTooltip()) m.unbindTooltip();
        const c = byNode[idx];
        m.setStyle({ fillColor: "#2c333f", fillOpacity: c ? 0.4 : 0.3, weight: 0 });
        m.setRadius(2.1);
        if (m._path) m._path.setAttribute("class", "leaflet-interactive");
      }
      for (const c of cells) {
        if (c.z_true !== 1) continue;
        const node = C.nodeById[c.node_idx]; if (!node || node.lat == null) continue;
        let caught = 0, present = 0;
        const states = C.MODEL_KEYS.map((mk) => {
          const cf = c[mk + "_conf"];
          if (cf === "nodata") return "nodata";
          present++; if (cf === "TP") { caught++; return "hit"; } return "miss";
        });
        const big = present && caught / present >= 0.5;
        const icon = L.divIcon({ className: "donut-ic", html: donutSVG(states, palette, big),
          iconSize: big ? [30, 30] : [24, 24], iconAnchor: big ? [15, 15] : [12, 12] });
        const mk = L.marker([node.lat, node.lon], { icon, riseOnHover: true });
        mk.on("click", () => onSelRef.current(c.node_idx));
        mk.bindTooltip(`<b>${node.route ? "Route " + node.route : node.segment_id}</b><br><span class="rt">${caught}/${present}개 모델 적중</span>`,
          { className: "node-tip", direction: "top", offset: [0, -8] });
        mk.addTo(donutRef.current);
      }
      return;
    }

    // single mode
    for (const [idx, m] of Object.entries(markersRef.current)) {
      if (m.getTooltip()) m.unbindTooltip();
      const c = byNode[idx];
      if (!c) {
        m.setStyle({ fillColor: "#333b48", fillOpacity: 0.4, weight: 0 });
        m.setRadius(2.2);
        if (m._path) m._path.setAttribute("class", "leaflet-interactive");
        continue;
      }
      const node = C.nodeById[idx];
      const cf = c[model + "_conf"];
      const col = confColor(cf);
      const active = cf === "TP" || cf === "FP" || cf === "FN";
      m.setStyle({ fillColor: col, color: col, fillOpacity: active ? 0.92 : 0.6, weight: 0 });
      m.setRadius(active ? 7.5 : 3.5);
      if (m._path) m._path.setAttribute("class", "leaflet-interactive dot-" + (cf || "nodata"));
      m.bindTooltip(`<b>${node.route ? "Route " + node.route : node.segment_id}</b> <span class="rt">${cf}</span><br>score ${c[model + "_score"] == null ? "—" : Number(c[model + "_score"]).toFixed(3)}`,
        { className: "node-tip", direction: "top", offset: [0, -4] });
    }
    for (const c of cells) {
      if (c.z_true === 1) {
        const node = C.nodeById[c.node_idx]; if (!node || node.lat == null) continue;
        L.circleMarker([node.lat, node.lon], { radius: 11, color: palette.truth, weight: 1.6, fill: false, opacity: 0.85, className: "ring-truth", interactive: false }).addTo(ringRef.current);
      }
    }
  }, [fold.key, tIdx, model, mapMode, palette.tp, palette.fp, palette.fn]);

  React.useEffect(() => {
    const map = mapRef.current; if (!map || !selRef.current) return;
    selRef.current.clearLayers();
    if (selectedNode == null) return;
    const node = C.nodeById[selectedNode]; if (!node || node.lat == null) return;
    L.circleMarker([node.lat, node.lon], { radius: 15, color: "#e8ecf2", weight: 1.4, fill: false, dashArray: "3 4", opacity: 0.8, interactive: false, className: "ring-sel" }).addTo(selRef.current);
  }, [selectedNode]);

  React.useEffect(() => {
    if (fitNonce === 0) return;
    const map = mapRef.current; if (!map) return;
    const tp = fold.timeline[tIdx];
    const cells = (tp && fold.cellsByT[tp.t_idx]) || [];
    const pts = cells.filter((c) => mapMode !== "consensus" || c.z_true === 1)
      .map((c) => C.nodeById[c.node_idx]).filter((n) => n && n.lat != null).map((n) => [n.lat, n.lon]);
    if (pts.length >= 1) map.flyToBounds(pts.length === 1 ? L.latLngBounds(pts).pad(2) : pts, { padding: [90, 90], maxZoom: 11, duration: 0.8 });
  }, [fitNonce]);

  return <div id="map" ref={elRef}></div>;
}