// tooltips.js — 3D-anchored glass tooltip with lock + links

import * as THREE from "https://esm.sh/three@0.160.0";

export function createHotspotTooltip({ camera, renderer, params }) {
  /* ---------------- DOM ---------------- */

  const el = document.createElement("div");
  el.className = "hotspot-tooltip";
  el.style.cssText = `
    position: fixed;
    min-width: 200px;
    padding: 12px 14px;
    border-radius: ${params.tooltipRadius}px;
    background: rgba(255,255,255,${params.tooltipOpacity});
    backdrop-filter: blur(${params.tooltipBlur}px);
    -webkit-backdrop-filter: blur(${params.tooltipBlur}px);
    color: ${params.tooltipTextColor};
    font: 13px system-ui, -apple-system, BlinkMacSystemFont;
    box-shadow: 0 12px 30px rgba(0,0,0,.18);
    transform: translate(-50%, -110%);
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
    z-index: 100000;
  `;

  document.body.appendChild(el);

  /* ---------------- State ---------------- */

  let hotspot = null;
  let locked = false;
  const worldPos = new THREE.Vector3();

  /* ---------------- Content builder ---------------- */

  function buildContent(data = {}) {
    const { label = "Info", links = [] } = data;

    el.innerHTML = `
      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        margin-bottom:8px;
        font-weight:600;
      ">
        <span>${label}</span>
        <button class="tooltip-close" style="
          border:none;
          background:none;
          cursor:pointer;
          font-size:14px;
          line-height:1;
          opacity:.6;
        ">✕</button>
      </div>

      <div class="tooltip-links" style="
        display:flex;
        flex-direction:column;
        gap:6px;
      ">
        ${links
          .map(
            (l) => `
          <a href="${l.url}" target="_blank" rel="noopener"
             style="
               display:flex;
               align-items:center;
               gap:8px;
               text-decoration:none;
               color:inherit;
               padding:6px 8px;
               border-radius:8px;
               background:rgba(255,255,255,.45);
             ">
            <img src="https://www.google.com/s2/favicons?domain=${l.url}&sz=32"
                 width="16" height="16" />
            <span>${l.label}</span>
          </a>
        `
          )
          .join("")}
      </div>
    `;

    el.querySelector(".tooltip-close").onclick = () => unlock();
  }

  /* ---------------- Core API ---------------- */

  function show(h) {
    if (locked && hotspot !== h) return;

    hotspot = h;

    buildContent(
      h.userData.tooltip || {
        label: h.userData.label || "Feature",
        links: [
          { label: "Thuisarts", url: "https://www.thuisarts.nl" },
          { label: "Thuisarts", url: "https://www.thuisarts.nl" },
          { label: "Thuisarts", url: "https://www.thuisarts.nl" },
        ],
      }
    );

    el.style.opacity = "1";
    el.style.pointerEvents = locked ? "auto" : "none";

    update();
  }

  function hide() {
    if (locked) return;
    hotspot = null;
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
  }

  function lock(h) {
    hotspot = h;
    locked = true;
    show(h);
    el.style.pointerEvents = "auto";
  }

  function unlock() {
    locked = false;
    hide();
  }

  function isLocked() {
    return locked;
  }

  function update() {
    if (!hotspot) return;

    hotspot.getWorldPosition(worldPos);
    worldPos.project(camera);

    const rect = renderer.domElement.getBoundingClientRect();
    const x = rect.left + (worldPos.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-worldPos.y * 0.5 + 0.5) * rect.height;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  /* ---------------- Live style sync ---------------- */

  function syncStyle() {
    el.style.background = `rgba(255,255,255,${params.tooltipOpacity})`;
    el.style.backdropFilter = `blur(${params.tooltipBlur}px)`;
    el.style.borderRadius = `${params.tooltipRadius}px`;
    el.style.color = params.tooltipTextColor;
  }

  /* ---------------- Public API ---------------- */

  return {
    show,
    hide,
    update,
    lock,
    unlock,
    isLocked,
    syncStyle,
  };
}
