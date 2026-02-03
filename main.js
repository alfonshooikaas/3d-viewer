import * as THREE from "https://esm.sh/three@0.160.0";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

// UI overlay
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
renderer.setSize(1, 1, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(3, 6, 2);
scene.add(dir);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;

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

function computeSceneBounds(object3d) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return { box, size, center };
}

function frameObject(object3d) {
  const { size, center } = computeSceneBounds(object3d);
  const maxDim = Math.max(size.x, size.y, size.z);

  // If bounds are empty (no geometry), tell us.
  if (!isFinite(maxDim) || maxDim === 0) {
    hud.textContent = "Loaded, but bounds are empty.\nNo visible geometry found.";
    return;
  }

  // Move model so center is at origin
  object3d.position.sub(center);

  // Fit camera to object
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
    `Tip: drag to rotate, scroll to zoom\n` +
    `Press "M" to toggle debug material`;
}

function countMeshes(object3d) {
  let meshes = 0;
  object3d.traverse((o) => {
    if (o.isMesh) meshes += 1;
  });
  return meshes;
}

// Optional: force a visible material to rule out “transparent/black” materials
let debugMaterialOn = false;
const originalMaterials = new WeakMap();
function setDebugMaterial(root, on) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      if (!originalMaterials.has(o)) originalMaterials.set(o, o.material);
      o.material = new THREE.MeshNormalMaterial();
    } else {
      const mat = originalMaterials.get(o);
      if (mat) o.material = mat;
    }
  });
}

let modelRoot = null;

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "m" && modelRoot) {
    debugMaterialOn = !debugMaterialOn;
    setDebugMaterial(modelRoot, debugMaterialOn);
    hud.textContent += `\nDebug material: ${debugMaterialOn ? "ON" : "OFF"}`;
  }
});

hud.textContent = "Loading model.glb…";

const loader = new GLTFLoader();
loader.load(
  "model.glb",
  (gltf) => {
    modelRoot = gltf.scene;
    scene.add(modelRoot);

    const meshes = countMeshes(modelRoot);
    hud.textContent = `Loaded scene. Meshes: ${meshes}\nFraming…`;

    // If there are zero meshes, the GLB may only contain empties or is hidden.
    if (meshes === 0) {
      hud.textContent =
        `Loaded, but found 0 meshes.\n` +
        `This GLB may contain only empties/cameras/lights.\n` +
        `Try exporting "Selected Objects" incl. meshes.`;
      return;
    }

    frameObject(modelRoot);
  },
  (ev) => {
    if (ev.total) {
      const pct = Math.round((ev.loaded / ev.total) * 100);
      hud.textContent = `Loading model.glb… ${pct}%`;
    }
  },
  (err) => {
    console.error(err);
    hud.textContent = "Failed to load model.glb (see console)";
  }
);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
