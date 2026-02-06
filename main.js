// main.js — Scene + UI + Hotspots orchestrator
// Expected files in repo root:
// index.html (loads main.js as type="module")
// main.js
// ui.js
// hotspots.js
// model.obj
// model.mtl (optional)

import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

import { createUI } from "./ui.js";
import { createHotspotSystem } from "./hotspots.js";

// ---------- FILES ----------
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl"; // "" if none
const TEXTURE_PATH = "";      // e.g. "textures/"
// --------------------------

// ---------- LIVE PARAMS (UI edits these) ----------
export const params = {
  background: "#FFE8E8",
  toneMapping: "ACES",
  exposure: 1.45,
  physicallyCorrectLights: false,

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

  overrideMaterials: false,
  overrideRoughness: 0.9,
  overrideMetalness: 0.0,
  meshColors: {},

  placeOnGround: false,
};

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

// ---------- Hotspot system ----------
const hotspotSystem = createHotspotSystem({
  pivot,
  camera,
  domElement: renderer.domElement,
});

// ---------- Apply look ----------
function applyLook() {
  scene.background = new THREE.Color(params.background);

  renderer.physicallyCorrectLights = !!params.physicallyCorrectLights;
  renderer.toneMapping =
    params.toneMapping === "ACES"
      ? THREE.ACESFilmicToneMapping
      : THREE.NoToneMapping;
  renderer.toneMappingExposure = params.exposure;

  ambient.color = new THREE.Color(params.ambientColor);
  ambient.intensity = params.ambientIntensity;

  hemi.color = new THREE.Color(params.hemiSky);
  hemi.groundColor = new THREE.Color(params.hemiGround);
  hemi.intensity = params.hemiIntensity;

  key.color = new THREE.Color(params.keyColor);
  key.intensity = params.keyIntensity;
  key.position.set(params.keyPosX, params.keyPosY, params.keyPosZ);

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

    const orig = originalMaterials.get(o);
    if (orig) o.material = orig;

    if (meshHex && o.material?.color) {
      o.material.color = new THREE.Color(meshHex);
    }

    if (o.material) {
      if ("metalness" in o.material) o.material.metalness = 0;
      if ("roughness" in o.material)
        o.material.roughness = Math.max(0.75, o.material.roughness ?? 0.9);
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
  if (!isFinite(maxDim) || maxDim === 0) return 1;

  pivot.position.set(-center.x, -center.y, -center.z);
  pivot.updateMatrixWorld(true);

  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxDim / 2) / Math.tan(fov / 2);
  distance *= 1.6;

  camera.near = Math.max(maxDim / 1000, 0.001);
  camera.far = Math.max(maxDim * 2000, 10);
  camera.updateProjectionMatrix();

  camera.position.set(0, maxDim * 0.22, distance);
  controls.target.set(0, 0, 0);
  controls.update();

  return maxDim;
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

      requestAnimationFrame(() => {
        const modelSize = centerAndFrame(obj);

        // ----- HOTSPOTS -----
        hotspotSystem.clearHotspots();

        // DEBUG hotspot (always visible)
        const debug = hotspotSystem.addHotspot(
          new THREE.Vector3(0, 0, 0),
          { label: "DEBUG" }
        );
        debug.position.z += modelSize * 0.3;

        // Example real hotspots (replace coords with your own)
        hotspotSystem.addHotspot(
          new THREE.Vector3(0.1, 0.15, 0.0),
          { label: "Top feature" }
        );

        hotspotSystem.addHotspot(
          new THREE.Vector3(-0.08, 0.05, 0.12),
          { label: "Side detail" }
        );

        // Auto-scale hotspots to model size
        hotspotSystem.hotspots.forEach(h => {
          h.scale.setScalar(modelSize * 0.04);
        });

        // ----- UI -----
        createUI({
          params,
          applyLook,
          refit: () => loadedObj && centerAndFrame(loadedObj),
        });
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

// ---------- Hotspot interaction ----------
renderer.domElement.addEventListener("pointerdown", (e) => {
  hotspotSystem.onPointerDown(e, (hotspot) => {
    console.log("Hotspot clicked:", hotspot.userData);
    hotspot.material.emissive?.set("#00BCD4");
  });
});

renderer.domElement.addEventListener("pointermove", (e) => {
  hotspotSystem.onPointerMove(e, (hotspot) => {
    hotspotSystem.hotspots.forEach(h => h.scale.setScalar(h.scale.x));
    if (hotspot) hotspot.scale.setScalar(hotspot.scale.x * 1.3);
  });
});

// ---------- Render loop ----------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
