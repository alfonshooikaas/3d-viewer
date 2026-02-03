// main.js — OBJ + MTL version (GitHub Pages friendly, no build tools)
//
// Expected files in repo root:
//   - index.html  (with <div id="app"></div> and <script type="module" src="./main.js"></script>)
//   - model.obj
//   - model.mtl          (if you exported materials)
//   - textures/...       (if your .mtl references texture images)
//
// Notes:
// - If you don't have a .mtl, this will still load the .obj with a default material fallback.
// - Keep filenames lowercase to avoid case-sensitive issues on GitHub Pages.

import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

// HUD overlay (helps when models fail silently)
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

// Helpers so you always see orientation
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
      "Loaded, but bounds are empty.\nNo visible geometry found in OBJ.";
    return;
  }

  // Recenter at origin
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

function applyFallbackMaterial(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    // If MTL didn't assign anything, give a neutral visible material
    if (!o.material) {
      o.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    }
    o.material.needsUpdate = true;
  });
}

// --- Load MTL then OBJ (preferred). If MTL missing/fails, load OBJ anyway. ---
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl";

// Helpful: set this if your .mtl references textures in a folder like "textures/"
const TEXTURE_PATH = ""; // e.g. "textures/"

hud.textContent = "Loading materials (model.mtl)…";

const mtlLoader = new MTLLoader();
if (TEXTURE_PATH) mtlLoader.setPath(TEXTURE_PATH);

// MTLLoader expects the .mtl in the same directory as the HTML by default.
mtlLoader.load(
  MTL_FILE,
  (materials) => {
    materials.preload();

    // Sometimes OBJ textures are dark; ensure they respond to our lights.
    // (No-op for most materials, but safe.)
    Object.values(materials.materials || {}).forEach((m) => {
      if (m) m.needsUpdate = true;
    });

    hud.textContent = "Loading geometry (model.obj)…";

    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);

    objLoader.load(
      OBJ_FILE,
      (obj) => {
        scene.add(obj);
        applyFallbackMaterial(obj);
        frameObject(obj);
      },
      undefined,
      (err) => {
        console.error("OBJ load error:", err);
        hud.textContent = "Failed to load model.obj (see console)";
      }
    );
  },
  undefined,
  (mtlErr) => {
    console.warn("MTL load failed (continuing without materials):", mtlErr);

    hud.textContent = "Loading geometry (model.obj) without materials…";

    const objLoader = new OBJLoader();
    objLoader.load(
      OBJ_FILE,
      (obj) => {
        // If no materials, make it visible
        applyFallbackMaterial(obj);
        scene.add(obj);
        frameObject(obj);

        hud.textContent += "\n(Loaded without MTL)";
        setTimeout(() => hud.remove(), 3000);
      },
      undefined,
      (objErr) => {
        console.error("OBJ load error:", objErr);
        hud.textContent = "Failed to load model.obj (see console)";
      }
    );
  }
);

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
