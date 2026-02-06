// hotspots.js
import * as THREE from "https://esm.sh/three@0.160.0";

/**
 * Creates a hotspot manager.
 * Hotspots are real 3D objects that:
 * - live in model space
 * - rotate with the model
 * - disappear behind geometry
 * - are raycast-interactable
 */
export function createHotspotSystem({
  pivot,
  camera,
  domElement,
}) {
  const hotspots = [];
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3b3b,
    roughness: 0.4,
    metalness: 0.0,
  });

  function addHotspot(position, data = {}) {
  const geo = new THREE.SphereGeometry(0.1, 24, 24); // 🔴 MUCH BIGGER

  const mat = new THREE.MeshStandardMaterial({
    color: 0xff2d55,
    emissive: 0xff2d55,     // 🔥 glow
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.0,
    depthTest: true,
  });

  const mesh = new THREE.Mesh(geo, mat);

  mesh.position.copy(position);
  mesh.userData = {
    type: "hotspot",
    ...data,
  };

  pivot.add(mesh);
  hotspots.push(mesh);

  return mesh;
}

  function clearHotspots() {
    hotspots.forEach(h => pivot.remove(h));
    hotspots.length = 0;
  }

  function raycastFromEvent(event) {
    const rect = domElement.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(hotspots, true);
  }

  function onPointerDown(event, onClick) {
    const hits = raycastFromEvent(event);
    if (hits.length && onClick) {
      onClick(hits[0].object);
    }
  }

  function onPointerMove(event, onHover) {
    const hits = raycastFromEvent(event);
    onHover?.(hits.length ? hits[0].object : null);
  }

  // Public API
  return {
    addHotspot,
    clearHotspots,
    onPointerDown,
    onPointerMove,
    hotspots,
  };
}
