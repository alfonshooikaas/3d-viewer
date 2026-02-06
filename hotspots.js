// hotspots.js
import * as THREE from "https://esm.sh/three@0.160.0";

export function createHotspotSystem({ pivot, camera, domElement }) {
  const hotspots = [];
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function addHotspot(position, data = {}) {
    const geometry = new THREE.SphereGeometry(1, 24, 24);

    const material = new THREE.MeshStandardMaterial({
      color: "#e1ff00",
      emissive: "#e1ff00",
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.0,
      transparent: true,
      opacity: 0.75,
      depthTest: true,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.userData = { type: "hotspot", ...data };

    pivot.add(mesh);
    hotspots.push(mesh);

    return mesh;
  }

  function clearHotspots() {
    hotspots.forEach(h => pivot.remove(h));
    hotspots.length = 0;
  }

  function raycast(event) {
    const rect = domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(hotspots, true);
  }

  function onPointerDown(event, cb) {
    const hits = raycast(event);
    if (hits.length && cb) cb(hits[0].object);
  }

  function onPointerMove(event) {
    const hits = raycast(event);
    return hits.length ? hits[0].object : null;
  }

  return {
    addHotspot,
    clearHotspots,
    onPointerDown,
    onPointerMove,
    hotspots,
  };
}
