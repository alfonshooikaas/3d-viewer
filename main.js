import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

// ---------- CONFIG ----------
const OBJ_FILE = "model.obj";
const MTL_FILE = "";              // e.g. "model.mtl" (leave "" if none)
const TEXTURE_PATH = "";          // e.g. "textures/" if your .mtl uses bare filenames
const PLACE_ON_GROUND = false;    // true => rests on floor; false => true center around origin
// ---------------------------

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

// Small HUD
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

// Optional helpers (keep while debugging)
scene.add(new THREE.GridHelper(10, 10));
scene.add(new THREE.AxesHelper(2));

// Camera/renderer
const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e9);
camera.position.set(0, 1, 3);

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

// Fallback material if no MTL
function applyFallbackMaterial(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.material) {
      o.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    }
    o.material.needsUpdate = true;
  });
}

// --- We wrap the loaded OBJ in a pivot group and move the pivot ---
const pivot = new THREE.Group();
scene.add(pivot);

// Debug: a small marker at origin (where we expect “center” to be after pivoting)
const originMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
scene.add(originMarker);

let loadedObject = null;

// Robust fit-to-view that assumes model is centered around origin (after pivot)
function fitToView(object3d) {
  object3d.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object3d);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  if (!isFinite(maxDim) || maxDim === 0) {
    hud.textContent = "Loaded, but bounds are empty.\nNo visible geometry found.";
    return;
  }

  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxDim / 2) / Math.tan(fov / 2);
  distance *= 1.6;

  camera.near = Math.max(maxDim / 1000, 0.001);
  camera.far = Math.max(maxDim * 2000, 10);
  camera.updateProjectionMatrix();

  // Since we recenter to origin, target is origin
  controls.target.set(0, PLACE_ON_GROUND ? maxDim * 0.15 : 0, 0);
  controls.update();

  camera.position.set(0, maxDim * 0.25, distance);
  camera.lookAt(controls.target);

  hud.textContent =
    `Loaded ✓\n` +
    `Approx size: ${maxDim.toFixed(4)}\n` +
    `Press F to refit`;
  setTimeout(() => hud.remove(), 2500);
}

// Recenters geometry by moving the pivot group (NOT the model itself)
function recenterIntoPivot(obj) {
  obj.updateMatrixWorld(true);

  // World-space bounds of the object as loaded
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());

  // Move pivot so that obj’s center ends up at origin
  // We do this by shifting pivot position by -center
  pivot.position.set(-center.x, -center.y, -center.z);

  // If you want "on ground", lift it so the bottom touches y=0
  if (PLACE_ON_GROUND) {
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj);
    const minY = box2.min.y;
    pivot.position.y -= minY; // lift so bottom sits at y=0
  }

  // After pivoting, fit camera
  fitToView(obj);
}

// Hotkey: refit camera
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "f" && loadedObject) {
    fitToView(loadedObject);
  }
});

// Load OBJ (optionally with MTL)
function loadObj(objLoader) {
  hud.textContent = `Loading ${OBJ_FILE}…`;

  objLoader.load(
    OBJ_FILE,
    (obj) => {
      // Clear previous
      pivot.clear();

      loadedObject = obj;
      pivot.add(obj);

      applyFallbackMaterial(obj);

      // This is the key centering step
      recenterIntoPivot(obj);
    },
    undefined,
    (err) => {
      console.error("OBJ load error:", err);
      hud.textContent = `Failed to load ${OBJ_FILE} (see console)`;
    }
  );
}

hud.textContent = "Loading…";

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
    (mtlErr) => {
      console.warn("MTL failed (continuing without materials):", mtlErr);
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
