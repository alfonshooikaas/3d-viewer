// hotspots.js — Pin-style hotspots (dot + small line into the object)

import * as THREE from "https://esm.sh/three@0.160.0";

export function createHotspotSystem({ pivot, camera, domElement }) {
  const hotspots = [];          // array of DOT meshes (for raycasting/hover)
  const pinGroups = [];         // array of GROUPs added to pivot
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Default styling (you can tweak)
  const DOT_COLOR = 0xe1ff00;
  const DOT_OPACITY = 1.0;

  // Pin line defaults (in world units)
  const DEFAULT_LINE_LENGTH = 0.08; // adjust overall "pin" depth
  const DEFAULT_LINE_WIDTH = 1;     // ignored by most WebGL implementations (kept for completeness)

  function pointerToNDC(event) {
    const rect = domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function clearHotspots() {
    pinGroups.forEach((g) => pivot.remove(g));
    pinGroups.length = 0;
    hotspots.length = 0;
  }

  /**
   * addHotspot(localPos, options)
   * localPos: THREE.Vector3 in model-local coordinates (same as before)
   * options:
   *   - label: string
   *   - lineLength: number (default DEFAULT_LINE_LENGTH)
   *   - lineColor: hex/string (default same as dot)
   *   - lineDirection: THREE.Vector3 (optional) direction the pin goes "into" the object
   *                    If omitted, it points toward pivot origin (0,0,0).
   */
  function addHotspot(localPos, options = {}) {
    const {
      label = "",
      lineLength = DEFAULT_LINE_LENGTH,
      lineColor = DOT_COLOR,
      lineDirection = null,
    } = options;

    // Group that holds dot + line
    const group = new THREE.Group();
    group.position.copy(localPos);

    // --- DOT ---
    const dotGeom = new THREE.SphereGeometry(1, 20, 20); // scale controls size
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

    // IMPORTANT: keep dot in hotspots array for raycasting
    hotspots.push(dot);

    // --- LINE (dot -> into object) ---
    // Direction in local space:
    // - if lineDirection provided: use it
    // - else: point from hotspot toward origin (0,0,0), i.e. "into the model"
    const dir =
      lineDirection && lineDirection.isVector3
        ? lineDirection.clone()
        : localPos.clone().multiplyScalar(-1);

    // Fallback if hotspot is exactly at origin
    if (dir.lengthSq() < 1e-10) dir.set(0, -1, 0);

    dir.normalize();

    const p0 = new THREE.Vector3(0, 0, 0); // start at dot center
    const p1 = dir.clone().multiplyScalar(lineLength); // go inward

    const lineGeom = new THREE.BufferGeometry().setFromPoints([p0, p1]);
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(lineColor),
      transparent: false,
      opacity: 1,
      linewidth: DEFAULT_LINE_WIDTH,
      depthTest: true,
      depthWrite: true,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    line.name = "HotspotLine";

    // Add to group
    group.add(line);
    group.add(dot);

    // Add group to pivot so it rotates with model
    pivot.add(group);
    pinGroups.push(group);

    return dot; // return dot mesh (compatible with your existing code)
  }

  // Raycast hit test (returns DOT mesh or null)
  function pickHotspot(event) {
    pointerToNDC(event);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(hotspots, false);
    return hits.length ? hits[0].object : null;
  }

  // Your main.js calls these
  function onPointerMove(event) {
    return pickHotspot(event);
  }

  function onPointerDown(event, onHit) {
    const hit = pickHotspot(event);
    if (hit && typeof onHit === "function") onHit(hit);
    return hit;
  }

  return {
    hotspots,        // array of DOT meshes (your main.js expects this)
    clearHotspots,
    addHotspot,
    onPointerMove,
    onPointerDown,
  };
}
