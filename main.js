import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

// ---------- CONFIG ----------
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl";      // "" if you don't have one
const TEXTURE_PATH = "";           // e.g. "textures/" if your .mtl uses bare filenames
const PLACE_ON_GROUND = false;     // true = sit on y=0, false = true center

// Blender "World" color (alpha ignored on web)
const WORLD_COLOR = "#FFE8E8";

// Look tuning (match Blender-by-eye)
const EXPOSURE = 1.50;             // try 1.15–1.45
const AMBIENT_INTENSITY = 0.75;    // lifts dark colors
const HEMI_INTENSITY = 0.95;       // soft world shading
const KEY_INTENSITY = 0.55;        // adds gentle form shading (invisible “lamp”)
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
scene.background = new THREE.Color(WORLD_COLOR);

// Helpers (keep off for clean look)
// scene.add(new THREE.GridHelper(10, 10));
// scene.add(new THREE.AxesHelper(2));

// Camera
const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e9);
camera.position.set(0, 1, 3);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// IMPORTANT for Blender-like brightness:
// - ACES lifts mids nicely
// - Exposure pushes overall brightness
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = EXPOSURE;

// IMPORTANT for this aesthetic:
// physicallyCorrectLights tends to look too dark compared to Blender viewport
renderer.physicallyCorrectLights = false;

container.appendChild(renderer.domElement);

// ---- Lighting: "world + a bit of shading" ----
// Ambient fill: lifts dark areas without adding directionality
scene.add(new THREE.AmbientLight(new THREE.Color(WORLD_COLOR), AMBIENT_INTENSITY));

// Hemisphere: soft environment shading (top/bottom). Give sky a slightly whiter tint.
scene.add(
  new THREE.HemisphereLight(
    new THREE.Color("#FFFFFF"),     // sky (slightly brighter)
    new THREE.Color(WORLD_COLOR),   // ground tint
    HEMI_INTENSITY
  )
);

// Soft key: subtle form shading without looking like a “light setup”
const key = new THREE.DirectionalLight(0xffffff, KEY_INTENSITY);
key.position.set(1.2, 2.0, 1.4);
scene.add(key);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;

// Resize (important: keep canvas CSS size + buffer aligned)
function resize() {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  if (!w || !h) return;

  // updateStyle=true prevents weird framing/offset issues
  renderer.setSize(w, h, true);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// Fallback material (if MTL missing). Keep rough, non-metal, slightly “matte”
function applyFallbackMaterial(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;

    if (!o.material) {
      o.material = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.9,
        metalness: 0.0,
      });
    }

    // If MTL created a Phong/Lambert-like material, it can look harsh/dark.
    // Nudge common properties gently without overriding colors.
    const m = o.material;
    if (m) {
      if ("metalness" in m) m.metalness = 0.0;
      if ("roughness" in m) m.roughness = Math.max(0.75, m.roughness ?? 0.9);
      m.needsUpdate = true;
    }
  });
}

// ---- Pivot centering approach (robust) ----
const pivot = new THREE.Group();
scene.add(pivot);

let loadedObj = null;

function centerAndFrame(obj) {
  resize();
  obj.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim === 0) {
    hud.textContent = "Loaded, but bounds are empty.";
    return;
  }

  pivot.position.set(-center.x, -center.y, -center.z);
  pivot.updateMatrixWorld(true);

  if (PLACE_ON_GROUND) {
    const box2 = new THREE.Box3().setFromObject(obj);
    pivot.position.y -= box2.min.y;
    pivot.updateMatrixWorld(true);
  }

  const box3 = new THREE.Box3().setFromObject(obj);
  const size3 = box3.getSize(new THREE.Vector3());
  const maxDim3 = Math.max(size3.x, size3.y, size3.z);

  const target = new THREE.Vector3(0, 0, 0);
  if (PLACE_ON_GROUND) target.y = (size3.y || maxDim3) * 0.45;

  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxDim3 / 2) / Math.tan(fov / 2);
  distance *= 1.6;

  camera.near = Math.max(maxDim3 / 1000, 0.001);
  camera.far = Math.max(maxDim3 * 2000, 10);
  camera.updateProjectionMatrix();

  camera.position.set(target.x, target.y + maxDim3 * 0.22, target.z + distance);
  controls.target.copy(target);
  camera.lookAt(target);
  controls.update();

  hud.textContent =
    `Loaded ✓\n` +
    `Exposure: ${renderer.toneMappingExposure}\n` +
    `Press F to refit, R to reset`;
  setTimeout(() => hud.remove(), 2000);
}

// Hotkeys
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
