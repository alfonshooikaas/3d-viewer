// tooltips.js — glassmorphism 3D-anchored tooltip with lock + close

import * as THREE from "https://esm.sh/three@0.160.0";

/* -------------------------------------------------- */
/* STYLES (injected once) */
/* -------------------------------------------------- */
(function injectTooltipStyles() {
  if (document.getElementById("hotspot-tooltip-style")) return;

  const style = document.createElement("style");
  style.id = "hotspot-tooltip-style";
  style.textContent = `
    .hotspot-tooltip {
      position: fixed;
      min-width: 240px;
      padding: 14px;
      border-radius: 16px;

      background:
        linear-gradient(
          to bottom,
          rgba(255,255,255,0.25),
          rgba(255,255,255,0)
        );

      border: 1px solid transparent;
      border-image: linear-gradient(
        to bottom,
        rgba(255,255,255,0.25),
        rgba(255,255,255,0.05),
        rgba(255,255,255,0.25)
      ) 1;

      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);

      box-shadow: 0 8px 18px rgba(0,0,0,0.18);

      font: 13px system-ui, -apple-system, BlinkMacSystemFont;
      color: #1e6e4b;

      transform: translate(-50%, -120%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 160ms ease;
      z-index: 99999;
    }

    .hotspot-tooltip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .hotspot-tooltip-close {
      border: none;
      background: none;
      cursor: pointer;
      font-size: 14px;
      opacity: 0.55;
    }

    .hotspot-tooltip-links {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .hotspot-tooltip a {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 8px;
      text-decoration: none;
      color: #1e6e4b;
      background: rgba(255,255,255,0.35);
      transition: background-color 140ms ease;
    }

    .hotspot-tooltip a:hover {
      background: #e1ff00;
    }
  `;
  document.head.appendChild(style);
})();

/* -------------------------------------------------- */
/* TOOLTIP SYSTEM */
/* -------------------------------------------------- */
export function createHotspotTooltip({ camera, renderer }) {
  const el = document.createElement("div");
  el.className = "hotspot-tooltip";
  document.body.appendChild(el);

  let hotspot = null;
  let locked = false;
  const v = new THREE.Vector3();

  function build(h) {
    el.innerHTML = `
      <div class="hotspot-tooltip-header">
        <span>${h.userData.label || "Feature"}</span>
        <button class="hotspot-tooltip-close">✕</button>
      </div>

      <div class="hotspot-tooltip-links">
        ${[1, 2, 3]
          .map(
            () => `
          <a href="https://www.thuisarts.nl" target="_blank" rel="noopener">
            <img src="https://www.google.com/s2/favicons?domain=thuisarts.nl&sz=32" width="16" height="16" />
            <span>Thuisarts</span>
          </a>
        `
          )
          .join("")}
      </div>
    `;

    el.querySelector(".hotspot-tooltip-close").onclick = unlock;
  }

  function show(h) {
    if (locked && h !== hotspot) return;

    hotspot = h;
    build(h);

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

    hotspot.getWorldPosition(v);
    v.project(camera);

    const rect = renderer.domElement.getBoundingClientRect();
    const x = rect.left + (v.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-v.y * 0.5 + 0.5) * rect.height;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  return {
    show,
    hide,
    lock,
    unlock,
    isLocked,
    update,
  };
}
