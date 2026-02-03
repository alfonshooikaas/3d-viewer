// main.js — OBJ viewer (GitHub Pages friendly, no build tools)
// Centers the model in the viewport by targeting the model's bounding-box center
// (does NOT move the model; instead it frames camera + OrbitControls target)
//
// Expected files (adjust constants below if your names differ):
//   - index.html  (contains <div id="app"></div> and <script type="module" src="./main.js"></script>)
//   - model.obj
//   - model.mtl   (optional; if missing, OBJ loads with fallback material)
//   - textures/…  (optional)

import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

// ---------- CONFIG ----------
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl";     // set to "" if you don't have one
const TEXTURE_PATH = "";          // e.g. "textures/" if your .mtl uses bare filenames
const PLACE_ON_GROUND = false;    // false = true center in viewport; true = aim slightly above floor
// ---------------------------

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

// HUD overlay
const hud = document.createElement("div");
hud.style.cssText =
  "position:fixed;left:12px;top:12px;z-index:9999;" +
  "padding:8px 10px;border-radius:10px;" +
  "font:12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;" +
  "background:rgba(0,0,0,.65);color:#fff;max-width:70vw;white-space:pre;";
hud.textContent = "Booting…";
document.body.appendChild(hud);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f2f2);

// Optional helpers (comment out when you're happy)
scene.add(new THREE.GridHelper(10, 10));
scene.add(new THREE.AxesHelper(2));

const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e9);
camera.position.set(0, 1, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
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

// Ensure meshes have a visible material when no MTL exists / fails
function applyFallbackMaterial(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;

    if (!o.material) {
      o.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    }

    // OBJ/MTL materials can be dark; make sure they respond well
    o.material.needsUpdate = true;
  });
}

// Framing that guarantees the model is centered in the viewport:
// - DO NOT move the model (OBJ pivots can be weird)
// - Compute bounding-box center in world space
// - Set OrbitControls target to that center
// - Place camera relative to that target
function frameObject(object3d, { placeOnGround = false } = {}) {
  object3d.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object3d);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim === 0) {
    hud.textContent = "Loaded, but bounds are empty.\nNo visible geometry found.";
    return;
  }

  // Choose a target:
  // - true center: target = bbox center
  // - "on ground": aim slightly above the floor so the object feels centered
  const target = center.clone();
  if (placeOnGround) {
    const floorY = box.min.y;
    const height = size.y || maxDim;
    target.y = floorY + height * 0.45;
  }

  // Fit camera distance to object size
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxDim / 2) / Math.tan(fov / 2);
  distance *= 1.6;

  camera.near = Math.max(maxDim / 1000, 0.001);
  camera.far = Math.max(maxDim * 2000, 10);
  camera.updateProjectionMatrix();

  // Place camera "in front" of the target and slightly above
  camera.position.set(target.x, target.y + maxDim * 0.25, target.z + distance);
  camera.lookAt(target);

  controls.target.copy(target);
  controls.update();

  hud.textContent =
    `Loaded ✓\n` +
    `Approx size: ${maxDim.toFixed(4)}\n` +
    `Target: (${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)})\n` +
    `Center mode: ${placeOnGround ? "ground-ish" : "true center"}\n` +
    `Drag to rotate, scroll to zoom`;
  setTimeout(() => hud.remove(), 2500);
}

// Load OBJ (with or without materials)
function loadObjWith(objLoader) {
  objLoader.load(
    OBJ_FILE,
    (obj) => {
      scene.add(obj);
      obj.updateMatrixWorld(true);

      applyFallbackMaterial(obj);
      frameObject(obj, { placeOnGround: PLACE_ON_GROUND });
    },
    undefined,
    (err) => {
      console.error("OBJ load error:", err);
      hud.textContent = "Failed to load model.obj (see console)";
    }
  );
}

hud.textContent = "Loading…";

if (MTL_FILE) {
  hud.textContent = "Loading materials (model.mtl)…";

  const mtlLoader = new MTLLoader();
  if (TEXTURE_PATH) mtlLoader.setPath(TEXTURE_PATH);

  mtlLoader.load(
    MTL_FILE,
    (materials) => {
      materials.preload();

      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);

      hud.textContent = "Loading geometry (model.obj)…";
      loadObjWith(objLoader);
    },
    undefined,
    (mtlErr) => {
      console.warn("MTL load failed (continuing without materials):", mtlErr);

      hud.textContent = "Loading geometry (model.obj) without materials…";
      const objLoader = new OBJLoader();
      loadObjWith(objLoader);
    }
  );
} else {
  hud.textContent = "Loading geometry (model.obj)…";
  const objLoader = new OBJLoader();
  loadObjWith(objLoader);
}

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
