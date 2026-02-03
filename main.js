// main.js — OBJ loader viewer (GitHub Pages friendly, no build tools)
//
// Expected files (adjust constants below if your names differ):
//   - index.html  (contains <div id="app"></div> and <script type="module" src="./main.js"></script>)
//   - model.obj
//   - model.mtl   (optional; if missing, OBJ will still load with a fallback material)
//   - textures/…  (optional; if .mtl references texture images)

import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

// ---------- CONFIG ----------
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl";     // set to "" if you don't have one
const TEXTURE_PATH = "";          // e.g. "textures/" if your .mtl uses bare filenames
const PLACE_ON_GROUND = true;     // true = rests on floor; false = true center
// ---------------------------

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

// Origin marker (small red dot)
scene.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  )
);

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

// Make sure meshes have a visible material if no MTL applied
function applyFallbackMaterial(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.material) {
      o.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    }
    o.material.needsUpdate = true;
  });
}

// Robust framing + centering for OBJ (handles offset pivots and huge/small scales)
function frameObject(object3d, { placeOnGround = true } = {}) {
  // Compute bounds
  const box = new THREE.Box3().setFromObject(object3d);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim === 0) {
    hud.textContent = "Loaded, but bounds are empty.\nNo visible geometry found.";
    return;
  }

  // Move model so its center is at origin
  // (using position adjustment avoids surprises with nested transforms)
  object3d.position.x += (object3d.position.x - center.x);
  object3d.position.y += (object3d.position.y - center.y);
  object3d.position.z += (object3d.position.z - center.z);

  object3d.updateMatrixWorld(true);

  // Optionally place on ground (y=0)
  if (placeOnGround) {
    const box2 = new THREE.Box3().setFromObject(object3d);
    const minY = box2.min.y;
    object3d.position.y -= minY;
    object3d.updateMatrixWorld(true);
  }

  // Final bounds after moves
  const box3 = new THREE.Box3().setFromObject(object3d);
  const size3 = box3.getSize(new THREE.Vector3());
  const maxDim3 = Math.max(size3.x, size3.y, size3.z);

  // Fit camera
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxDim3 / 2) / Math.tan(fov / 2);
  distance *= 1.6;

  camera.near = Math.max(maxDim3 / 1000, 0.001);
  camera.far = Math.max(maxDim3 * 2000, 10);
  camera.updateProjectionMatrix();

  camera.position.set(0, maxDim3 * 0.25, distance);

  // If on ground, target slightly above ground so it "feels" centered
  controls.target.set(0, placeOnGround ? maxDim3 * 0.15 : 0, 0);
  controls.update();

  hud.textContent =
    `Loaded ✓\n` +
    `Approx size: ${maxDim3.toFixed(4)}\n` +
    `Drag to rotate, scroll to zoom\n` +
    `Center mode: ${placeOnGround ? "on ground" : "true center"}`;
  setTimeout(() => hud.remove(), 2500);
}

function loadOBJ(withMaterials) {
  hud.textContent = withMaterials
    ? "Loading geometry (model.obj) with materials…"
    : "Loading geometry (model.obj) without materials…";

  const objLoader = new OBJLoader();

  if (withMaterials) {
    // materials are already set in caller
  }

  objLoader.load(
    OBJ_FILE,
    (obj) => {
      scene.add(obj);

      // Some OBJs need a forced update before bounds are correct
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

// Load sequence: MTL then OBJ; fallback to OBJ-only
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
    },
    undefined,
    (mtlErr) => {
      console.warn("MTL load failed (continuing without materials):", mtlErr);
      loadOBJ(false);
    }
  );
} else {
  loadOBJ(false);
}

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
