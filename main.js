import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

// ---------- CONFIG ----------
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl";     // "" if you don't have one
const TEXTURE_PATH = "";          // e.g. "textures/" if your .mtl uses bare filenames
const PLACE_ON_GROUND = true;     // true = sit on y=0, false = true center
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

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f2f2);

// Helpers (remove later if you want)
scene.add(new THREE.GridHelper(10, 10));
scene.add(new THREE.AxesHelper(2));

// Camera
const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e9);
camera.position.set(0, 1, 3);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(3, 6, 2);
scene.add(dir);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;

// Resize (important: call before framing)
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

// Fallback material
function applyFallbackMaterial(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.material) o.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    o.material.needsUpdate = true;
  });
}

// ---- Pivot centering approach (robust) ----
const pivot = new THREE.Group();
scene.add(pivot);

let loadedObj = null;

function centerAndFrame(obj) {
  // Make sure aspect/viewport is correct right now
  resize();

  obj.updateMatrixWorld(true);

  // 1) Compute bounds in world
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim === 0) {
    hud.textContent = "Loaded, but bounds are empty.";
    return;
  }

  // 2) Reset pivot and move it so that center becomes origin
  pivot.position.set(-center.x, -center.y, -center.z);
  pivot.updateMatrixWorld(true);

  // 3) Optional: place on ground (y=0)
  if (PLACE_ON_GROUND) {
    const box2 = new THREE.Box3().setFromObject(obj);
    const minY = box2.min.y;
    pivot.position.y -= minY; // lift so bottom touches y=0
    pivot.updateMatrixWorld(true);
  }

  // 4) Recompute size after pivot move (important)
  const box3 = new THREE.Box3().setFromObject(obj);
  const size3 = box3.getSize(new THREE.Vector3());
  const maxDim3 = Math.max(size3.x, size3.y, size3.z);

  // 5) Define target (center of screen)
  const target = new THREE.Vector3(0, 0, 0);
  if (PLACE_ON_GROUND) {
    target.y = (size3.y || maxDim3) * 0.45; // feel centered while standing on ground
  }

  // 6) Compute camera distance to fit object
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxDim3 / 2) / Math.tan(fov / 2);
  distance *= 1.6;

  camera.near = Math.max(maxDim3 / 1000, 0.001);
  camera.far = Math.max(maxDim3 * 2000, 10);
  camera.updateProjectionMatrix();

  // 7) Place camera and aim correctly
  camera.position.set(target.x, target.y + maxDim3 * 0.25, target.z + distance);
  controls.target.copy(target);
  camera.lookAt(target);
  controls.update();

  hud.textContent =
    `Loaded ✓\n` +
    `Approx size: ${maxDim3.toFixed(4)}\n` +
    `Press F to refit, R to reset`;
  setTimeout(() => hud.remove(), 2500);
}

// Hotkeys: F to refit, R to reset view
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "f" && loadedObj) centerAndFrame(loadedObj);
  if (k === "r") controls.reset();
});

// Load OBJ (with or without MTL)
function loadObj(objLoader) {
  hud.textContent = `Loading ${OBJ_FILE}…`;

  objLoader.load(
    OBJ_FILE,
    (obj) => {
      pivot.clear();
      loadedObj = obj;
      pivot.add(obj);

      applyFallbackMaterial(obj);

      // Let the browser do one layout/render tick so matrices stabilize
      requestAnimationFrame(() => centerAndFrame(obj));
    },
    undefined,
    (err) => {
      console.error("OBJ load error:", err);
      hud.textContent = `Failed to load ${OBJ_FILE} (see console)`;
    }
  );
}

// MTL -> OBJ (fallback to OBJ-only)
if (MTL_FILE) {
  hud.textContent = `Loading ${MTL_FILE}…`;
  const mtlLoader = new MTLLoader();
  if (TEXTURE_PATH) mtlLoader.setPath(TEXTURE_PATH);

  mtlLoader.load(
    MTL_FILE,
    (materials) => {
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      loadObj(objLoader);
    },
    undefined,
    (err) => {
      console.warn("MTL failed, continuing without materials:", err);
      loadObj(new OBJLoader());
    }
  );
} else {
  loadObj(new OBJLoader());
}

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
