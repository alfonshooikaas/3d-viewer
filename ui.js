// ui.js
export function createUI({ params, applyLook, refit }) {
  injectStyles();

  const panel = document.createElement("div");
  panel.className = "ui-panel";
  document.body.appendChild(panel);

  let pos = { x: 16, y: 16 };
  setPos(pos.x, pos.y);

  /* ---------- Header ---------- */
  const header = document.createElement("div");
  header.className = "ui-header";

  const title = document.createElement("div");
  title.className = "ui-title";
  title.textContent = "Viewer Controls";

  const toggle = document.createElement("button");
  toggle.className = "ui-toggle";
  toggle.textContent = "▾";

  header.append(title, toggle);
  panel.appendChild(header);

  /* ---------- Body ---------- */
  const body = document.createElement("div");
  body.className = "ui-body";
  panel.appendChild(body);

  let collapsed = false;
  toggle.onclick = () => {
    collapsed = !collapsed;
    panel.classList.toggle("ui-collapsed", collapsed);
    toggle.textContent = collapsed ? "▸" : "▾";
  };

  makeDraggable(panel, header, setPos, () => pos);

  /* ---------- UI helpers ---------- */

  function row(label) {
    const r = document.createElement("div");
    r.className = "ui-row";

    const l = document.createElement("div");
    l.className = "ui-label";
    l.textContent = label;

    const v = document.createElement("div");
    v.className = "ui-value";

    r.append(l, v);
    body.appendChild(r);
    return v;
  }

  function slider(label, value, min, max, step, onChange) {
    const v = row(label);

    const range = document.createElement("input");
    range.type = "range";
    range.min = min;
    range.max = max;
    range.step = step;
    range.value = value;

    const num = document.createElement("input");
    num.type = "number";
    num.min = min;
    num.max = max;
    num.step = step;
    num.value = value;

    function sync(val) {
      const x = clamp(Number(val), min, max);
      range.value = x;
      num.value = x;
      onChange(x);
    }

    range.oninput = () => sync(range.value);
    num.oninput = () => sync(num.value);

    v.append(range, num);
  }

  function color(label, value, onChange) {
    const v = row(label);
    const c = document.createElement("input");
    c.type = "color";
    c.value = value;
    c.oninput = () => onChange(c.value);
    v.appendChild(c);
  }

  function button(label, fn) {
    const v = row("");
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = fn;
    v.appendChild(b);
  }

  /* ---------- Controls ---------- */

  slider("Exposure", params.exposure, 0.6, 2.0, 0.01, v => {
    params.exposure = v;
    applyLook();
  });

  slider("Ambient", params.ambientIntensity, 0, 2, 0.01, v => {
    params.ambientIntensity = v;
    applyLook();
  });

  slider("Hemisphere", params.hemiIntensity, 0, 2, 0.01, v => {
    params.hemiIntensity = v;
    applyLook();
  });

  slider("Key Light", params.keyIntensity, 0, 2, 0.01, v => {
    params.keyIntensity = v;
    applyLook();
  });

  color("Background", params.background, v => {
    params.background = v;
    applyLook();
  });

  button("Refit (F)", refit);

  /* ---------- Positioning ---------- */

  function setPos(x, y) {
    pos.x = x;
    pos.y = y;
    panel.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
}

/* ================== DRAG SYSTEM ================== */

function makeDraggable(panel, handle, setPos, getPos) {
  let dragging = false;
  let startX = 0, startY = 0;
  let baseX = 0, baseY = 0;
  let nextX = 0, nextY = 0;
  let raf = null;

  let panelW = 0;
  let panelH = 0;

  handle.style.cursor = "grab";

  function update() {
    raf = null;
    setPos(nextX, nextY);
  }

  handle.addEventListener("pointerdown", (e) => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const pos = getPos();
    baseX = pos.x;
    baseY = pos.y;
    startX = e.clientX;
    startY = e.clientY;

    const rect = panel.getBoundingClientRect();
    panelW = rect.width;
    panelH = rect.height;
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const margin = 8;
    const maxX = window.innerWidth - panelW - margin;
    const maxY = window.innerHeight - panelH - margin;

    nextX = clamp(baseX + dx, margin, Math.max(margin, maxX));
    nextY = clamp(baseY + dy, margin, Math.max(margin, maxY));

    if (!raf) raf = requestAnimationFrame(update);
  });

  function stop() {
    dragging = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  handle.addEventListener("pointerup", stop);
  handle.addEventListener("pointercancel", stop);
}

/* ================== STYLES ================== */

function injectStyles() {
  if (document.getElementById("ui-style")) return;

  const s = document.createElement("style");
  s.id = "ui-style";
  s.textContent = `
    .ui-panel{
      position:fixed;
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
      cursor:grab;
      border-bottom:1px solid rgba(0,0,0,0.08);
    }
    .ui-title{ pointer-events:none; }
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
    .ui-collapsed .ui-body{ display:none; }
    .ui-row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
    }
    .ui-label{ flex:1; color:#333; }
    .ui-value{
      display:flex;
      gap:6px;
      align-items:center;
    }
    input[type=range]{ width:120px; }
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
