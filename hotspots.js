// hotspots.js — Pin-style hotspots (dot + thick pin toward model center)

import * as THREE from "https://esm.sh/three@0.160.0";

export function createHotspotSystem({ pivot, camera, domElement }) {
  const hotspots = [];   // DOT meshes for raycasting
  const groups = [];     // groups added to pivot
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Visual defaults (tweak as desired)
  const DOT_COLOR = 0xe1ff00;
  const DOT_OPACITY = 1.0;

  // Pin defaults (world/model units)
  const DEFAULT_PIN_RADIUS = 0.004;  // thickness (increase for "fatter")
  const DEFAULT_PIN_OPACITY = 1.0;

  function pointerToNDC(event) {
    const rect = domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function clearHotspots() {
    groups.forEach((g) => pivot.remove(g));
    groups.length = 0;
    hotspots.length = 0;
  }

  /**
   * addHotspot(localPos, options)
   * localPos: THREE.Vector3 in model-local coordinates
   *
   * options:
   *  - label: string
   *  - pinToCenter: boolean (default true)  // if true, pin goes to (0,0,0)
   *  - pinLength: number (optional)         // if provided, pin goes "toward center" by this length only
   *  - pinRadius: number (default DEFAULT_PIN_RADIUS)
   *  - pinColor: hex/string (default DOT_COLOR)
   *  - pinOpacity: number 0..1 (default 1)
   */
  function addHotspot(localPos, options = {}) {
    const {
      label = "",
      pinToCenter = true,
      pinLength = null,
      pinRadius = DEFAULT_PIN_RADIUS,
      pinColor = DOT_COLOR,
      pinOpacity = DEFAULT_PIN_OPACITY,
    } = options;

    const group = new THREE.Group();
    group.position.copy(localPos);

    // --- DOT ---
    const dotGeom = new THREE.SphereGeometry(1, 20, 20); // scaled externally by main.js
    const dotMat = new THREE.MeshBasicMaterial({
      color: DOT_COLOR,
      transparent: DOT_OPACITY < 1,
      opacity: DOT_OPACITY,
      depthTest: true,
      depthWrite: true,
    });
    const dot = new THREE.Mesh(dotGeom, dotMat);
    dot.name = "HotspotDot";
    dot.userData.label = label;
    dot.userData._isHotspotDot = true;

    hotspots.push(dot);

    // --- PIN (thick cylinder) ---
    // Direction to model center: from hotspot (localPos) to origin (0,0,0)
    // Since group is positioned at localPos, in GROUP-local space:
    //  - hotspot is at (0,0,0)
    //  - model center is at (-localPos)
    const toCenter = pinToCenter
      ? localPos.clone().multiplyScalar(-1)
      : new THREE.Vector3(0, -1, 0);

    // If hotspot happens to be at origin, fall back to a default direction
    if (toCenter.lengthSq() < 1e-10) toCenter.set(0, -1, 0);

    const fullLen = toCenter.length();
    const useLen = pinLength != null ? Math.min(Math.max(pinLength, 0), fullLen) : fullLen;

    const dir = toCenter.clone().normalize(); // direction in group-local space

    // Cylinder is centered on its Y axis by default.
    // We'll orient it so +Y aligns with dir, then shift it "into" the model.
    const cylGeom = new THREE.CylinderGeometry(pinRadius, pinRadius, useLen, 16, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(pinColor),
      transparent: pinOpacity < 1,
      opacity: pinOpacity,
      depthTest: true,
      depthWrite: true,
    });

    const pin = new THREE.Mesh(cylGeom, cylMat);
    pin.name = "HotspotPin";

    // Orient cylinder: default axis is +Y
    const up = new THREE.Vector3(0, 1, 0);
    pin.quaternion.setFromUnitVectors(up, dir);

    // Position the cylinder so it starts at dot center and goes inward.
    // Since cylinder is centered, move it half-length along dir.
    pin.position.copy(dir.clone().multiplyScalar(useLen / 2));

    // Add to group
    group.add(pin);
    group.add(dot);

    pivot.add(group);
    groups.push(group);

    return dot;
  }

  // Raycast hit test (returns DOT mesh or null)
  function pickHotspot(event) {
    pointerToNDC(event);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(hotspots, false);
    return hits.length ? hits[0].object : null;
  }

  function onPointerMove(event) {
    return pickHotspot(event);
  }

  function onPointerDown(event, onHit) {
    const hit = pickHotspot(event);
    if (hit && typeof onHit === "function") onHit(hit);
    return hit;
  }

  return {
    hotspots, // DOT meshes used by your main.js hover scaling
    clearHotspots,
    addHotspot,
    onPointerMove,
    onPointerDown,
  };
}
