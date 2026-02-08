// hotspots.js — Pin-style hotspots (dot + thick pin toward model center)
// Dot scale is controlled externally (main.js)

import * as THREE from "https://esm.sh/three@0.160.0";

export function createHotspotSystem({ pivot, camera, domElement }) {
  const hotspots = [];   // DOT meshes (for raycasting + hover)
  const groups = [];     // Full pin groups added to pivot

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  /* -------------------------------------------------- */
  /* Pointer → NDC                                      */
  /* -------------------------------------------------- */
  function pointerToNDC(event) {
    const rect = domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /* -------------------------------------------------- */
  /* Clear                                              */
  /* -------------------------------------------------- */
  function clearHotspots() {
    groups.forEach(g => pivot.remove(g));
    groups.length = 0;
    hotspots.length = 0;
  }

  /* -------------------------------------------------- */
  /* Add hotspot                                        */
  /* -------------------------------------------------- */
  /**
   * addHotspot(localPos, options)
   *
   * localPos: THREE.Vector3 (model-local coordinates)
   *
   * options:
   *  - label: string
   *  - pinToCenter: boolean (default true)
   *  - pinLength: number (optional, world units)
   *  - pinRadius: number (default 0.004)
   *  - pinColor: hex/string (default #e1ff00)
   *  - pinOpacity: number 0..1 (default 1)
   */
  function addHotspot(localPos, options = {}) {
    const {
      label = "",
      pinToCenter = true,
      pinLength = null,
      pinRadius = 0.004,
      pinColor = "#e1ff00",
      pinOpacity = 1.0,
    } = options;

    /* ---------- Group ---------- */
    const group = new THREE.Group();
    group.position.copy(localPos);

    /* ---------- Direction to model center ---------- */
    // In group-local space, model center is (-localPos)
    const toCenter = pinToCenter
      ? localPos.clone().multiplyScalar(-1)
      : new THREE.Vector3(0, -1, 0);

    // Fallback if hotspot is at origin
    if (toCenter.lengthSq() < 1e-10) toCenter.set(0, -1, 0);

    const fullLen = toCenter.length();
    const useLen =
      pinLength != null
        ? Math.min(Math.max(pinLength, 0), fullLen)
        : fullLen;

    const dir = toCenter.clone().normalize();

    /* ---------- Pin (shaft) ---------- */
    const shaftRadius = pinRadius * 2; // 🔑 thick pin (200%)
    const shaftGeom = new THREE.CylinderGeometry(
      shaftRadius,
      shaftRadius,
      useLen,
      16,
      1,
      true
    );

    const shaftMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(pinColor),
      transparent: pinOpacity < 1,
      opacity: pinOpacity,
      depthTest: true,
      depthWrite: true,
    });

    const pin = new THREE.Mesh(shaftGeom, shaftMat);
    pin.name = "HotspotPin";

    // Orient cylinder (+Y → dir)
    pin.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir
    );

    // Move so it starts at dot center and goes inward
    pin.position.copy(dir.clone().multiplyScalar(useLen / 2));

    /* ---------- Dot (head) ---------- */
    // Geometry is unit-sized; scale is applied externally
    const dotGeom = new THREE.SphereGeometry(1, 20, 20);
    const dotMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(pinColor), // 🔑 unified color
      transparent: pinOpacity < 1,
      opacity: pinOpacity,
      depthTest: true,
      depthWrite: true,
    });

    const dot = new THREE.Mesh(dotGeom, dotMat);
    dot.name = "HotspotDot";
    dot.userData.label = label;
    dot.userData._isHotspotDot = true;

    /* ---------- Assemble ---------- */
    group.add(pin);
    group.add(dot);
    pivot.add(group);

    groups.push(group);
    hotspots.push(dot);

    return dot;
  }

  /* -------------------------------------------------- */
  /* Raycasting                                         */
  /* -------------------------------------------------- */
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

  /* -------------------------------------------------- */
  /* Public API                                         */
  /* -------------------------------------------------- */
  return {
    hotspots,        // DOT meshes (used by main.js for scaling)
    clearHotspots,
    addHotspot,
    onPointerMove,
    onPointerDown,
  };
}
