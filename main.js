// main.js — Three.js engine + UI hookup
// Files expected in repo root:
// index.html (loads main.js as type="module")
// main.js
// ui.js
// model.obj
// model.mtl (optional)

import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";
import { createUI } from "./ui.js";

// ---------- FILES ----------
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl"; // "" if none
const TEXTURE_PATH = "";      // e.g. "textures/"
// --------------------------

// ---------- LIVE PARAMS (UI edits these) ----------
export const params = {
  // renderer / scene
  background: "#FFE8E8",
  toneMapping: "ACES",          // "ACES" | "NONE"
  exposure: 1.45,
  physicallyCorrectLights: false,

  // lighting
  ambientColor: "#FFE8E8",
  ambientIntensity: 1.75,

  hemiSky: "#FFFFFF",
  hemiGround: "#FFE8E8",
  hemiIntensity: 0.8,

  keyColor: "#FFFFFF",
  keyIntensity: 1.25,
  keyPosX: 1.2,
  keyPosY: 2.0,
  keyPosZ: 1.4,

  // materials
  overrideMaterials: false,
  overrideRoughness: 0.9,
  overrideMetalness: 0.0,
  meshColors: {},

  // framing
  placeOnGround: false,
};
// ----------------------------------------------

// ---------- DOM ----------
const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

// ---------- Scene ----------
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e9);
camera.position.set(0, 1, 3);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;

// Resize
function resize() {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  if (!w || !h) return;

  renderer.setSize(w, h, true);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------- Lights ----------
const ambient = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1);
scene.add(key);

// ---------- Model container ----------
const pivot = new THREE.Group();
scene.add(pivot);

let loadedObj = null;
const originalMaterials = new WeakMap();

// ---------- Apply look ----------
function applyLook() {
  // background
  scene.background = new THREE.Color(params.background);

  // renderer
  renderer.physicallyCorrectLights = !!params.physicallyCorrectLights;
  renderer.toneMapping =
    params.toneMapping === "ACES"
      ? THREE.ACESFilmicToneMapping
      : THREE.NoToneMapping;
  renderer.toneMappingExposure = params.exposure;

  // lights
  ambient.color = new THREE.Color(params.ambientColor);
  ambient.intensity = params.ambientIntensity;

  hemi.color = new THREE.Color(params.hemiSky);
  hemi.groundColor = new THREE.Color(params.hemiGround);
  hemi.intensity = params.hemiIntensity;

  key.color = new THREE.Color(params.keyColor);
  key.intensity = params.keyIntensity;
  key.position.set(params.keyPosX, params.keyPosY, params.keyPosZ);

  // materials
  if (loadedObj) applyMaterials(loadedObj);
}

// ---------- Materials ----------
function applyMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;

    if (!originalMaterials.has(o)) {
      originalMaterials.set(o, o.material);
    }

    const meshHex = params.meshColors[o.uuid];

    if (params.overrideMaterials) {
      const baseHex =
        meshHex ||
        (o.material?.color ? `#${o.material.color.getHexString()}` : "#cccccc");

      o.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseHex),
        roughness: params.overrideRoughness,
        metalness: params.overrideMetalness,
      });
      o.material.needsUpdate = true;
      return;
    }

    // restore original
    const orig = originalMaterials.get(o);
    if (orig) o.material = orig;

    if (meshHex && o.material?.color) {
      o.material.color = new THREE.Color(meshHex);
    }

    // pastel-friendly tweak
    if (o.material) {
      if ("metalness" in o.material) o.material.metalness = 0;
      if ("roughness" in o.material) o.material.roughness = Math.max(0.75, o.material.roughness ?? 0.9);
      o.material.needsUpdate = true;
    }
  });
}

// ---------- Center + frame ----------
function centerAndFrame(obj) {
  resize();
  obj.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim === 0) return;

  pivot.position.set(-center.x, -center.y, -center.z);
  pivot.updateMatrixWorld(true);

  if (params.placeOnGround) {
    const box2 = new THREE.Box3().setFromObject(obj);
    pivot.position.y -= box2.min.y;
    pivot.updateMatrixWorld(true);
  }

  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxDim / 2) / Math.tan(fov / 2);
  distance *= 1.6;

  camera.near = Math.max(maxDim / 1000, 0.001);
  camera.far = Math.max(maxDim * 2000, 10);
  camera.updateProjectionMatrix();

  const target = new THREE.Vector3(0, 0, 0);
  camera.position.set(0, maxDim * 0.22, distance);
  controls.target.copy(target);
  camera.lookAt(target);
  controls.update();
}

// ---------- Load OBJ ----------
function loadObj(objLoader) {
  objLoader.load(
    OBJ_FILE,
    (obj) => {
      pivot.clear();
      loadedObj = obj;
      pivot.add(obj);

      applyLook();
      requestAnimationFrame(() => centerAndFrame(obj));

      createUI({
        params,
        applyLook,
        refit: () => loadedObj && centerAndFrame(loadedObj),
      });
    },
    undefined,
    (err) => console.error("OBJ load error:", err)
  );
}

// ---------- Load sequence ----------
if (MTL_FILE) {
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
    () => loadObj(new OBJLoader())
  );
} else {
  loadObj(new OBJLoader());
}

// Hotkey
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "f" && loadedObj) centerAndFrame(loadedObj);
});

// ---------- Render loop ----------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
