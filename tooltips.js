// tooltips.js — 3D-anchored tooltip for hotspots (safe, isolated)

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

  let currentHotspot = null;
  const worldPos = new THREE.Vector3();

  function show(hotspot, text = "") {
    currentHotspot = hotspot;
    el.textContent = text;
    el.style.opacity = "1";
    update(); // immediate position
  }

  function hide() {
    currentHotspot = null;
    el.style.opacity = "0";
  }

  function update() {
    if (!currentHotspot) return;

    currentHotspot.getWorldPosition(worldPos);
    worldPos.project(camera);

    const rect = renderer.domElement.getBoundingClientRect();
    const x = rect.left + (worldPos.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-worldPos.y * 0.5 + 0.5) * rect.height;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  return { show, hide, update };
}
