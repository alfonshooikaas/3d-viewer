// tooltips.js — 3D-anchored glass tooltip (refined glassmorphism)

import * as THREE from "https://esm.sh/three@0.160.0";

export function createHotspotTooltip({ camera, renderer, params }) {
  /* -------------------------------------------------- */
  /* DOM                                                 */
  /* -------------------------------------------------- */

  const el = document.createElement("div");
  el.className = "hotspot-tooltip";
  el.style.cssText = `
    position: fixed;
    min-width: 220px;
    padding: 14px 14px 12px;
    border-radius: ${params.tooltipRadius}px;
    background:
      linear-gradient(
        to bottom,
        rgba(255,255,255,0.25),
        rgba(255,255,255,0.0)
      );
    backdrop-filter: blur(${params.tooltipBlur}px);
    -webkit-backdrop-filter: blur(${params.tooltipBlur}px);
    color: ${params.tooltipTextColor};
    font: 13px system-ui, -apple-system, BlinkMacSystemFont;
    box-shadow: 0 10px 26px rgba(0,0,0,0.06); /* ~30% of previous */
    transform: translate(-50%, -115%);
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
    z-index: 100000;
  `;

  // Gradient outline via pseudo-border
  el.style.border = "1px solid transparent";
  el.style.backgroundOrigin = "border-box";
  el.style.backgroundClip = "padding-box, border-box";
  el.style.backgroundImage = `
    linear-gradient(
      to bottom,
      rgba(255,255,255,0.25),
      rgba(255,255,255,0.0)
    ),
    linear-gradient(
      to bottom,
      rgba(255,255,255,0.25),
      rgba(255,255,255,0.05),
      rgba(255,255,255,0.25)
    )
  `;

  document.body.appendChild(el);

  /* -------------------------------------------------- */
  /* State                                               */
  /* -------------------------------------------------- */

  let hotspot = null;
  let locked = false;
  const worldPos = new THREE.Vector3();

  /* -------------------------------------------------- */
  /* Content                                             */
  /* -------------------------------------------------- */

  function buildContent(data = {}) {
    const { label = "Info", links = [] } = data;

    el.innerHTML = `
      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        margin-bottom:10px;
        font-weight:600;
      ">
        <span>${label}</span>
        <button class="tooltip-close" style="
          border:none;
          background:none;
          cursor:pointer;
          font-size:14px;
          line-height:1;
          opacity:.55;
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
             class="tooltip-link"
             style="
               display:flex;
               align-items:center;
               gap:8px;
               padding:6px 8px;
               border-radius:8px;
               text-decoration:none;
               color:#1e6e4b;
               background:rgba(255,255,255,0.35);
               transition: background 120ms ease;
             ">
            <img
              src="https://www.google.com/s2/favicons?domain=${l.url}&sz=32"
              width="16"
              height="16"
            />
            <span>${l.label}</span>
          </a>
        `
          )
          .join("")}
      </div>
    `;

    // Hover color for links
    el.querySelectorAll(".tooltip-link").forEach((a) => {
      a.onmouseenter = () => (a.style.background = "#e1ff00");
      a.onmouseleave = () =>
        (a.style.background = "rgba(255,255,255,0.35)");
    });

    el.querySelector(".tooltip-close").onclick = () => unlock();
  }

  /* -------------------------------------------------- */
  /* API                                                 */
  /* -------------------------------------------------- */

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

  function syncStyle() {
    // reserved for future live updates via UI
  }

  return {
    show,
    hide,
    lock,
    unlock,
    isLocked,
    update,
    syncStyle,
  };
}
