// tooltips.js — Glassmorphism tooltip anchored to 3D hotspots (lockable)

import * as THREE from "https://esm.sh/three@0.160.0";

export function createHotspotTooltip({ camera, renderer }) {
  let activeHotspot = null;
  let locked = false;

  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed;
    min-width: 220px;
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(255,255,255,0.45);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 10px 30px rgba(0,0,0,.15);
    color: #111;
    font: 13px system-ui;
    transform: translate(-50%, -130%);
    opacity: 0;
    transition: opacity 150ms ease;
    pointer-events: auto;
    z-index: 9999;
  `;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <strong>More information</strong>
      <button id="tt-close" style="border:none;background:none;font-size:16px;cursor:pointer;">✕</button>
    </div>
    <ul style="list-style:none;padding:0;margin:0;display:grid;gap:6px">
      ${link("Thuisarts", "https://www.thuisarts.nl")}
      ${link("Thuisarts", "https://www.thuisarts.nl")}
      ${link("Thuisarts", "https://www.thuisarts.nl")}
    </ul>
  `;

  document.body.appendChild(el);
  el.querySelector("#tt-close").onclick = () => {
    locked = false;
    hide();
  };

  const v = new THREE.Vector3();

  function link(name, url) {
    const favicon = new URL("/favicon.ico", url).href;
    return `
      <li>
        <a href="${url}" target="_blank" style="display:flex;gap:8px;align-items:center;text-decoration:none;color:#111;">
          <img src="${favicon}" width="16" height="16" />
          ${name}
        </a>
      </li>`;
  }

  function show(h) {
    if (locked) return;
    activeHotspot = h;
    el.style.opacity = "1";
    update();
  }

  function lock(h) {
    activeHotspot = h;
    locked = true;
    el.style.opacity = "1";
    update();
  }

  function hide() {
    if (locked) return;
    activeHotspot = null;
    el.style.opacity = "0";
  }

  function update() {
    if (!activeHotspot) return;

    activeHotspot.getWorldPosition(v);
    v.project(camera);

    if (v.z < 0 || v.z > 1) {
      el.style.opacity = "0";
      return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    el.style.left = `${rect.left + (v.x * 0.5 + 0.5) * rect.width}px`;
    el.style.top = `${rect.top + (-v.y * 0.5 + 0.5) * rect.height}px`;
  }

  return { show, hide, lock, update, isLocked: () => locked };
}
