// ui.js
export function createUI({ params, applyLook, centerAndFrame, getMeshes }) {
  injectStyles();

  const panel = document.createElement("div");
  panel.className = "ui-panel";
  panel.style.transform = "translate(16px,16px)";
  document.body.appendChild(panel);

  panel.innerHTML = `
    <div class="ui-header">Viewer Controls <button id="toggle">▾</button></div>
    <div class="ui-body">
      <label>Exposure <input id="exposure" type="range" min="0.6" max="2" step="0.01"></label>
      <label>Ambient <input id="ambient" type="range" min="0" max="2" step="0.01"></label>
      <label>Background <input id="bg" type="color"></label>
      <button id="refit">Refit</button>
    </div>
  `;

  const body = panel.querySelector(".ui-body");

  // Init values
  panel.querySelector("#exposure").value = params.exposure;
  panel.querySelector("#ambient").value = params.ambientIntensity;
  panel.querySelector("#bg").value = params.background;

  // Bind events
  panel.querySelector("#exposure").oninput = e => {
    params.exposure = Number(e.target.value);
    applyLook();
  };

  panel.querySelector("#ambient").oninput = e => {
    params.ambientIntensity = Number(e.target.value);
    applyLook();
  };

  panel.querySelector("#bg").oninput = e => {
    params.background = e.target.value;
    applyLook();
  };

  panel.querySelector("#refit").onclick = () => centerAndFrame();

  // Collapse
  panel.querySelector("#toggle").onclick = () => {
    body.style.display = body.style.display === "none" ? "" : "none";
  };

  makeDraggable(panel, panel.querySelector(".ui-header"));
}

// ---------- helpers ----------
function makeDraggable(el, handle) {
  let sx, sy, bx, by, dragging = false;

  handle.style.cursor = "grab";
  handle.onpointerdown = e => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    sx = e.clientX;
    sy = e.clientY;
    const m = el.style.transform.match(/-?\d+/g) || [16,16];
    bx = +m[0]; by = +m[1];
  };

  handle.onpointermove = e => {
    if (!dragging) return;
    el.style.transform = `translate(${bx + e.clientX - sx}px, ${by + e.clientY - sy}px)`;
  };

  handle.onpointerup = () => dragging = false;
}

function injectStyles() {
  if (document.getElementById("ui-style")) return;
  const s = document.createElement("style");
  s.id = "ui-style";
  s.textContent = `
    .ui-panel{
      position:fixed;
      background:rgba(255,255,255,.92);
      backdrop-filter:blur(10px);
      border-radius:14px;
      width:260px;
      box-shadow:0 10px 30px rgba(0,0,0,.2);
      font:12px system-ui;
      z-index:99999;
    }
    .ui-header{
      padding:10px;
      font-weight:600;
      display:flex;
      justify-content:space-between;
      cursor:grab;
      border-bottom:1px solid rgba(0,0,0,.1);
    }
    .ui-body{
      padding:10px;
      display:flex;
      flex-direction:column;
      gap:10px;
    }
    label{ display:flex; justify-content:space-between; gap:10px; }
    input[type=range]{ flex:1; }
    button{ padding:6px; border-radius:8px; }
  `;
  document.head.appendChild(s);
}
