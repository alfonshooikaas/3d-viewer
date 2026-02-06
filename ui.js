// ui.js
export function createUI({ params, applyLook, refit, getMeshes }) {
  injectStyles();

  const panel = document.createElement("div");
  panel.className = "ui-panel";
  document.body.appendChild(panel);

  // initial position
  let pos = { x: 16, y: 16 };
  setPos(pos.x, pos.y);

  // header
  const header = document.createElement("div");
  header.className = "ui-header";
  header.innerHTML = `
    <div class="ui-title">Viewer Controls</div>
    <button class="ui-toggle">▾</button>
  `;
  panel.appendChild(header);

  // body
  const body = document.createElement("div");
  body.className = "ui-body";
  panel.appendChild(body);

  let collapsed = false;

  header.querySelector(".ui-toggle").onclick = () => {
    collapsed = !collapsed;
    panel.classList.toggle("ui-collapsed", collapsed);
    header.querySelector(".ui-toggle").textContent = collapsed ? "▸" : "▾";
  };

  makeDraggable(panel, header, setPos, () => pos);

  /* ---------- helpers ---------- */

  function row(label) {
    const r = document.createElement("div");
    r.className = "ui-row";

    const l = document.createElement("div");
    l.className = "ui-label";
    l.textContent = label;

    const v = document.createElement("div");
    v.className = "ui-value";

    r.appendChild(l);
    r.appendChild(v);
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
    num.value = value;
    num.min = min;
    num.max = max;
    num.step = step;

    function sync(val) {
      const x = Math.min(max, Math.max(min, Number(val)));
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

  /* ---------- controls ---------- */

  slider("Exposure", params.exposure, 0.6, 2.0, 0.01, v => {
    params.exposure = v;
    applyLook();
  });

  slider("Ambient", params.ambientIntensity, 0, 2, 0.01, v => {
    params.ambientIntensity = v;
    applyLook();
  });

  slider("Hemi", params.hemiIntensity, 0, 2, 0.01, v => {
    params.hemiIntensity = v;
    applyLook();
  });

  slider("Key", params.keyIntensity, 0, 2, 0.01, v => {
    params.keyIntensity = v;
    applyLook();
  });

  color("Background", params.background, v => {
    params.background = v;
    applyLook();
  });

  button("Refit (F)", refit);

  /* ---------- positioning ---------- */

  function setPos(x, y) {
    pos.x = x;
    pos.y = y;
    panel.style.transform = `translate(${x}px, ${y}px)`;
  }
}

/* ================== DRAG ================== */

function makeDraggable(panel, handle, setPos, getPos) {
  let dragging = false;
  let sx = 0, sy = 0, bx = 0, by = 0;

  handle.style.cursor = "grab";

  handle.onpointerdown = e => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    const p = getPos();
    bx = p.x;
    by = p.y;
    sx = e.clientX;
    sy = e.clientY;
    handle.style.cursor = "grabbing";
  };

  handle.onpointermove = e => {
    if (!dragging) return;

    const dx = e.clientX - sx;
    const dy = e.clientY - sy;

    const w = panel.offsetWidth;
    const h = panel.offsetHeight;

    const maxX = window.innerWidth - w - 8;
    const maxY = window.innerHeight - h - 8;

    const x = clamp(bx + dx, 8, maxX);
    const y = clamp(by + dy, 8, maxY);

    setPos(x, y);
  };

  handle.onpointerup = () => {
    dragging = false;
    handle.style.cursor = "grab";
  };
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
      background:rgba(255,255,255,.92);
      backdrop-filter:blur(12px);
      border-radius:14px;
      box-shadow:0 10px 30px rgba(0,0,0,.2);
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
      border-bottom:1px solid rgba(0,0,0,.1);
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
    .ui-label{ flex:1; }
    .ui-value{
      display:flex;
      gap:6px;
      align-items:center;
    }
    input[type=range]{ width:120px; }
    input[type=number]{ width:60px; }
    button{
      padding:6px 10px;
      border-radius:8px;
      border:1px solid rgba(0,0,0,.1);
      background:#fff;
      cursor:pointer;
    }
  `;
  document.head.appendChild(s);
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}
