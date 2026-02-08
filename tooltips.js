// tooltips.js — stable glass tooltip with lock + close

import * as THREE from "https://esm.sh/three@0.160.0";

export function createHotspotTooltip({ camera, renderer, params }) {
  const el = document.createElement("div");
  el.className = "hotspot-tooltip";
  el.style.cssText = `
    position: fixed;
    min-width: 220px;
    padding: 14px;
    border-radius: 14px;
    background:
      linear-gradient(
        to bottom,
        rgba(255,255,255,0.25),
        rgba(255,255,255,0)
      );
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 10px 26px rgba(0,0,0,0.06);
    border: 1px solid rgba(255,255,255,0.15);
    font: 13px system-ui;
    color: #1e6e4b;
    transform: translate(-50%, -120%);
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
    z-index: 99999;
  `;
  document.body.appendChild(el);

  let hotspot = null;
  let locked = false;
  const v = new THREE.Vector3();

  function build(h) {
    el.innerHTML = `
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:8px;
        font-weight:600;
      ">
        <span>${h.userData.label || "Feature"}</span>
        <button class="close" style="
          border:none;
          background:none;
          cursor:pointer;
          opacity:.5;
          font-size:14px;
        ">✕</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px">
        ${[1,2,3].map(() => `
          <a href="https://www.thuisarts.nl" target="_blank"
             style="
               display:flex;
               align-items:center;
               gap:8px;
               padding:6px 8px;
               border-radius:8px;
               text-decoration:none;
               color:#1e6e4b;
               background:rgba(255,255,255,.35);
             ">
            <img src="https://www.google.com/s2/favicons?domain=thuisarts.nl&sz=32" width="16" />
            <span>Thuisarts</span>
          </a>
        `).join("")}
      </div>
    `;

    el.querySelector(".close").onclick = unlock;
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

    const r = renderer.domElement.getBoundingClientRect();
    el.style.left = `${r.left + (v.x * .5 + .5) * r.width}px`;
    el.style.top = `${r.top + (-v.y * .5 + .5) * r.height}px`;
  }

  return { show, hide, lock, unlock, isLocked, update };
}
