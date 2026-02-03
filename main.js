// main.js — FBX version (GitHub Pages friendly, no build tools)
//
// Files expected in repo root:
//   - index.html (with <div id="app"></div> and <script type="module" src="./main.js"></script>)
//   - model.fbx
//
// Optional (if you exported textures separately):
//   - textures/...

import * as THREE from "https://esm.sh/three@0.160.0";
import { FBXLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

// Small on-screen status (useful when things go wrong)
const hud = document.createElement("div");
hud.style.cssText =
  "position:fixed;left:12px;top:12px;z-index:9999;" +
  "padding:8px 10px;border-radius:10px;" +
  "font:12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;" +
  "background:rgba(0,0,0,.65);color:#fff;max-width:60vw;white-space:pre;";
hud.textContent = "Booting…";
document.body.appendChild(hud);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f2f2);

// Helpers so you always see *something*
scene.add(new THREE.GridHelper(10, 10));
scene.add(new THREE.AxesHelper(2));

const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e9);
camera.position.set(0, 1, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
container.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(3, 6, 2);
scene.add(dir);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;

// Resize
function resize() {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  if (!w || !h) return;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// Fit camera to object (robust for huge/tiny models)
function frameObject(object3d) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim === 0) {
    hud.textContent =
      "Loaded, but bounds are empty.\nNo visible geometry found in FBX.";
    return;
  }

  // Recenter model at origin
  object3d.position.sub(center);

  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const padded = distance * 1.6;

  camera.near = Math.max(maxDim / 1000, 0.001);
  camera.far = Math.max(maxDim * 2000, 10);
  camera.updateProjectionMatrix();

  camera.position.set(0, maxDim * 0.25, padded);
  controls.target.set(0, 0, 0);
  controls.update();

  hud.textContent =
    `Loaded ✓\n` +
    `Approx size: ${maxDim.toFixed(4)}\n` +
    `Drag to rotate, scroll to zoom`;
  setTimeout(() => hud.remove(), 2000);
}

// FBX loading
hud.textContent = "Loading model.fbx…";

const loader = new FBXLoader();
loader.load(
  "model.fbx",
  (model) => {
    // FBX often comes in as a Group with nested Meshes
    scene.add(model);

    // Optional: improve look if materials are too dark
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;

      // Many FBX materials are MeshPhongMaterial; keep them, but ensure they respond to light.
      if (o.material) {
        o.material.needsUpdate = true;
      }
    });

    frameObject(model);
  },
  (ev) => {
    if (ev.total) {
      const pct = Math.round((ev.loaded / ev.total) * 100);
      hud.textContent = `Loading model.fbx… ${pct}%`;
    } else {
      hud.textContent = "Loading model.fbx…";
    }
  },
  (err) => {
    console.error("FBX load error:", err);
    hud.textContent = "Failed to load model.fbx (see console)";
  }
);

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
