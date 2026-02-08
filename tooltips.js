// tooltips.js — minimal 3D-anchored tooltip (safe, isolated)

import * as THREE from "https://esm.sh/three@0.160.0";

export function createHotspotTooltip({ camera, renderer }) {
  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(255,255,255,0.5);
    color: #000;
    font: 12px system-ui, sans-serif;
    pointer-events: none;
    white-space: nowrap;
    transform: translate(-50%, -130%);
    opacity: 0;
    transition: opacity 120ms ease;
    z-index: 9999;
  `;
  document.body.appendChild(el);

  let hotspot = null;
  const v = new THREE.Vector3();

  function show(h, text = "") {
    hotspot = h;
    el.textContent = text;
    el.style.opacity = "1";
    update();
  }

  function hide() {
    hotspot = null;
    el.style.opacity = "0";
  }

  function update() {
    if (!hotspot) return;

    hotspot.getWorldPosition(v);
    v.project(camera);

    const rect = renderer.domElement.getBoundingClientRect();
    el.style.left = `${rect.left + (v.x * 0.5 + 0.5) * rect.width}px`;
    el.style.top  = `${rect.top  + (-v.y * 0.5 + 0.5) * rect.height}px`;
  }

  return { show, hide, update };
}
