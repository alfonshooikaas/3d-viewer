// main.js — OBJ viewer (GitHub Pages friendly, no build tools)
// Fixes "model appears in corner" by:
// 1) Wrapping the OBJ in a pivot group
// 2) Recentering pivot using bounding box
// 3) Explicitly aiming camera + OrbitControls at the same target

import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

// ---------- CONFIG ----------
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl";     // "" if you don't have one
const TEXTURE_PATH = "";          // e.g. "textures/" if .mtl uses bare filenames
const PLACE_ON_GROUND = true;     // true = sit on y=0, false = true center
// ---------------------------

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f2f2);

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
controls.screenSpacePanning = false;

// IMPORTANT: If min/max distance is too tight it can feel "stuck" in a corner.
// Keep these wide for now.
controls.minDistance = 0.0001;
controls.maxDistance = 1e12;

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

// Fallback material if no MTL assigned
function applyFallbackMaterial(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.material) o.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    o.material.needsUpdate = true;
  });
}

// Pivot group: we move THIS to center the model, not the model itself
const pivot = new THREE.Group();
scene.add(pivot);

let loaded = null;

// Center + frame logic
function centerAndFrame(model) {
  model.updateMatrixWorld(true);

  // Bounds of model (as currently positioned)
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim === 0) {
    console.warn("Model bounds empty.");
    return;
  }

  // Reset pivot and then offset it so model center goes to origin
  pivot.position.set(0, 0, 0);
  pivot.updateMatrixWorld(true);

  // Move pivot so the model's CENTER lands at origin
  pivot.position.set(-center.x, -center.y, -center.z);
  pivot.updateMatrixWorld(true);

  // If you want "on ground", lift so bbox bottom touches y=0
  if (PLACE_ON_GROUND) {
    const box2 = new THREE.Box3().setFromObject(model);
    const minY = box2.min.y;
    pivot.position.y -= minY;
    pivot.updateMatrixWorld(true);
  }

  // After moving pivot, recompute bounds (important!)
  const box3 = new THREE.Box3().setFromObject(model);
  const size3 = box3.getSize(new THREE.Vector3());
  const maxDim3 = Math.max(size3.x, size3.y, size3.z);

  // Choose a target that matches the centered model
  // Since we forced center -> origin, our target is near origin.
  const target = new THREE.Vector3(0, 0, 0);

  // If on ground, aim slightly above the base so it feels centered
  if (PLACE_ON_GROUND) target.y = (size3.y || maxDim3) * 0.45;

  // Fit camera distance to object
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxDim3 / 2) / Math.tan(fov / 2);
  distance *= 1.6;

  camera.near = Math.max(maxDim3 / 1000, 0.001);
  camera.far = Math.max(maxDim3 * 2000, 10);
  camera.updateProjectionMatrix();

  // Place camera "in front" of target and slightly above
  camera.position.set(target.x, target.y + maxDim3 * 0.25, target.z + distance);

  // CRUCIAL: make sure camera + controls agree on the target
  controls.target.copy(target);
  camera.lookAt(target);
  controls.update();

  // Optional: store this as the reset state
  controls.saveState();

  // Helpful debug log
  console.log("Framed model. size:", size3, "target:", target, "cam:", camera.position);
}

// Load OBJ (with optional MTL)
function loadOBJ(objLoader) {
  objLoader.load(
    OBJ_FILE,
    (obj) => {
      // Clear previous
      pivot.clear();
      loaded = obj;
      pivot.add(obj);

      applyFallbackMaterial(obj);

      // Some OBJs need a tick before bounds stabilize (fonts/mtl/etc)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          centerAndFrame(obj);
        });
      });
    },
    undefined,
    (err) => console.error("OBJ load error:", err)
  );
}

if (MTL_FILE) {
  const mtlLoader = new MTLLoader();
  if (TEXTURE_PATH) mtlLoader.setPath(TEXTURE_PATH);

  mtlLoader.load(
    MTL_FILE,
    (materials) => {
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      loadOBJ(objLoader);
    },
    undefined,
    (err) => {
      console.warn("MTL load failed; loading OBJ without materials:", err);
      loadOBJ(new OBJLoader());
    }
  );
} else {
  loadOBJ(new OBJLoader());
}

// Hotkeys
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "f" && loaded) centerAndFrame(loaded); // refit
  if (k === "r") controls.reset();                 // reset view
});

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
