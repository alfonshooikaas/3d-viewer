// ui.js — Extended, sectioned, collapsible viewer UI

export function createUI({ params, applyLook, refit }) {
  injectStyles();

  const panel = document.createElement("div");
  panel.className = "ui-panel ui-collapsed";
  document.body.appendChild(panel);

  /* ---------- Header ---------- */
  const header = document.createElement("div");
  header.className = "ui-header";

  const title = document.createElement("div");
  title.className = "ui-title";
  title.textContent = "Viewer Controls";

  const toggle = document.createElement("button");
  toggle.className = "ui-toggle";
  toggle.textContent = "▸";

  header.append(title, toggle);
  panel.appendChild(header);

  /* ---------- Body ---------- */
  const body = document.createElement("div");
  body.className = "ui-body";
  panel.appendChild(body);

  let collapsed = true;
  toggle.onclick = () => {
    collapsed = !collapsed;
    panel.classList.toggle("ui-collapsed", collapsed);
    toggle.textContent = collapsed ? "▸" : "▾";
  };

  /* ---------- Helpers ---------- */

  function section(titleText) {
    const s = document.createElement("div");
    s.className = "ui-section";

    const h = document.createElement("div");
    h.className = "ui-section-header";
    h.textContent = titleText;

    const c = document.createElement("div");
    c.className = "ui-section-content";

    let open = false;
    h.onclick = () => {
      open = !open;
      s.classList.toggle("open", open);
    };

    s.append(h, c);
    body.appendChild(s);
    return c;
  }

  function row(parent, label) {
    const r = document.createElement("div");
    r.className = "ui-row";

    const l = document.createElement("div");
    l.className = "ui-label";
    l.textContent = label;

    const v = document.createElement("div");
    v.className = "ui-value";

    r.append(l, v);
    parent.appendChild(r);
    return v;
  }

  function slider(parent, label, key, min, max, step = 0.01) {
    const v = row(parent, label);

    const range = document.createElement("input");
    range.type = "range";
    range.min = min;
    range.max = max;
    range.step = step;
    range.value = params[key];

    const num = document.createElement("input");
    num.type = "number";
    num.min = min;
    num.max = max;
    num.step = step;
    num.value = params[key];

    function sync(val) {
      const x = clamp(Number(val), min, max);
      range.value = x;
      num.value = x;
      params[key] = x;
      applyLook();
    }

    range.oninput = () => sync(range.value);
    num.oninput = () => sync(num.value);

    v.append(range, num);
  }

  function color(parent, label, key) {
    const v = row(parent, label);
    const c = document.createElement("input");
    c.type = "color";
    c.value = params[key];
    c.oninput = () => {
      params[key] = c.value;
      applyLook();
    };
    v.appendChild(c);
  }

  function button(parent, label, fn) {
    const v = row(parent, "");
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = fn;
    v.appendChild(b);
  }

  /* ---------- Sections ---------- */

  // Lighting
  const lighting = section("Lighting");
  slider(lighting, "Exposure", "exposure", 0.6, 2.0);
  slider(lighting, "Ambient", "ambientIntensity", 0, 2);
  slider(lighting, "Hemisphere", "hemiIntensity", 0, 2);
  slider(lighting, "Key light", "keyIntensity", 0, 2);
  color(lighting, "Background", "background");

  // Hotspots
  const hs = section("Hotspots / Pins");
  slider(hs, "Dot size", "hotspotDotSize", 0.2, 3);
  slider(hs, "Dot opacity", "hotspotDotOpacity", 0, 1);
  color(hs, "Dot color", "hotspotDotColor");
  slider(hs, "Pin thickness", "hotspotPinRadius", 0.2, 3);
  slider(hs, "Pin length", "hotspotPinLength", 0.2, 3);
  slider(hs, "Hover scale", "hotspotHoverScale", 1, 2);

  // Tooltip
  const tt = section("Tooltip");
  slider(tt, "Opacity", "tooltipOpacity", 0.1, 1);
  slider(tt, "Blur", "tooltipBlur", 0, 30, 1);
  slider(tt, "Radius", "tooltipRadius", 4, 24, 1);
  color(tt, "Text color", "tooltipTextColor");

  // Mesh hover
  const mh = section("Mesh hover");
  slider(mh, "Dim opacity", "meshDimOpacity", 0, 1);
  slider(mh, "Hover darken", "meshHoverDarken", 0.5, 1);
  slider(mh, "Fade speed", "meshOpacityLerp", 0.05, 0.3);

  // Utilities
  const util = section("Utilities");
  button(util, "Refit model", refit);
}

/* ================== STYLES ================== */

function injectStyles() {
  if (document.getElementById("ui-style")) return;

  const s = document.createElement("style");
  s.id = "ui-style";
  s.textContent = `
    .ui-panel{
      position:fixed;
      top:16px;
      left:16px;
      width:300px;
      background:rgba(255,255,255,0.92);
      backdrop-filter:blur(12px);
      border-radius:14px;
      box-shadow:0 10px 30px rgba(0,0,0,0.22);
      font:12px system-ui;
      z-index:99999;
      user-select:none;
    }
    .ui-header{
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:10px;
      font-weight:600;
      border-bottom:1px solid rgba(0,0,0,0.08);
      cursor:pointer;
    }
    .ui-toggle{
      border:none;
      background:transparent;
      cursor:pointer;
      font-size:14px;
    }
    .ui-body{
      padding:10px;
      display:flex;
      flex-direction:column;
      gap:8px;
    }
    .ui-collapsed .ui-body{
      display:none;
    }
    .ui-section{
      border-top:1px solid rgba(0,0,0,0.08);
      padding-top:6px;
    }
    .ui-section-header{
      font-weight:600;
      cursor:pointer;
      margin-bottom:6px;
    }
    .ui-section-content{
      display:none;
      flex-direction:column;
      gap:6px;
    }
    .ui-section.open .ui-section-content{
      display:flex;
    }
    .ui-row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
    }
    .ui-label{
      flex:1;
      color:#333;
    }
    .ui-value{
      display:flex;
      gap:6px;
      align-items:center;
    }
    input[type=range]{
      width:120px;
    }
    input[type=number]{
      width:60px;
      border-radius:6px;
      border:1px solid rgba(0,0,0,0.15);
      padding:2px 4px;
    }
    button{
      padding:6px 10px;
      border-radius:8px;
      border:1px solid rgba(0,0,0,0.15);
      background:#fff;
      cursor:pointer;
    }
  `;
  document.head.appendChild(s);
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}
