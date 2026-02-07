// main.js — Scene + UI + Hotspots orchestrator (COMPLETE & SAFE)
// Includes: OBJ+MTL load, pastel lighting, UI, hotspots, smooth hover scale to 125%

import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

import { createUI } from "./ui.js";
import { createHotspotSystem } from "./hotspots.js";

// ----------------------------------------------------
// FILES
// ----------------------------------------------------
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl";

// ----------------------------------------------------
// PARAMETERS (UI edits these)
// ----------------------------------------------------
export const params = {
  background: "#FFE8E8",
  toneMapping: "ACES",
  exposure: 1.45,

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
};

// ----------------------------------------------------
// DOM / SCENE
// ----------------------------------------------------
const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

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

// ----------------------------------------------------
// LIGHTING
// ----------------------------------------------------
const ambient = new THREE.AmbientLight(0xffffff, 1);
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
const key = new THREE.DirectionalLight(0xffffff, 1);
scene.add(ambient, hemi, key);

// ----------------------------------------------------
// MODEL PIVOT
// ----------------------------------------------------
const pivot = new THREE.Group();
scene.add(pivot);

let loadedObj = null;

// ----------------------------------------------------
// HOTSPOT SYSTEM
// ----------------------------------------------------
const hotspotSystem = createHotspotSystem({
  pivot,
  camera,
  domElement: renderer.domElement,
});

let hoveredHotspot = null;

// Hover animation tuning
const HOVER_SCALE_MULT = 1.25; // 125%
const HOVER_LERP = 0.15;       // 0..1 (higher = snappier)

// ----------------------------------------------------
// APPLY LOOK
// ----------------------------------------------------
function applyLook() {
  scene.background = new THREE.Color(params.background);

  renderer.toneMapping =
    params.toneMapping === "ACES"
      ? THREE.ACESFilmicToneMapping
      : THREE.NoToneMapping;
  renderer.toneMappingExposure = params.exposure;

  ambient.color.set(params.ambientColor);
  ambient.intensity = params.ambientIntensity;

  hemi.color.set(params.hemiSky);
  hemi.groundColor.set(params.hemiGround);
  hemi.intensity = params.hemiIntensity;

  key.color.set(params.keyColor);
  key.intensity = params.keyIntensity;
  key.position.set(params.keyPosX, params.keyPosY, params.keyPosZ);
}

// ----------------------------------------------------
// CENTER + FRAME
// ----------------------------------------------------
function centerAndFrame(obj) {
  obj.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim === 0) return 1;

  pivot.position.set(-center.x, -center.y, -center.z);

  const distance =
    (maxDim / 2) /
    Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
    1.6;

  camera.near = Math.max(maxDim / 1000, 0.001);
  camera.far = Math.max(maxDim * 2000, 10);
  camera.updateProjectionMatrix();

  camera.position.set(0, maxDim * 0.22, distance);
  controls.target.set(0, 0, 0);
  controls.update();

  return maxDim;
}

// ----------------------------------------------------
// LOAD MODEL
// ----------------------------------------------------
function loadObj(loader) {
  loader.load(
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

        // Make dots smaller in normal state
        const BASE_SCALE = modelSize * 0.06;

        // DEBUG hotspot (remove later)
        hotspotSystem.addHotspot(
          new THREE.Vector3(0, 0, modelSize * 0.3),
          { label: "DEBUG" }
        );

        // Your hotspots (replace positions)
        hotspotSystem.addHotspot(
          new THREE.Vector3(0.1, 0.15, 0.0),
          { label: "Top feature" }
        );
        hotspotSystem.addHotspot(
          new THREE.Vector3(-0.08, 0.05, 0.12),
          { label: "Side detail" }
        );

        // Initialize per-hotspot animation state
        hotspotSystem.hotspots.forEach((h) => {
          h.userData.baseScale = BASE_SCALE;
          h.userData.targetScale = BASE_SCALE;
          h.scale.setScalar(BASE_SCALE);
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

// Load sequence
if (MTL_FILE) {
  const mtlLoader = new MTLLoader();
  mtlLoader.load(
    MTL_FILE,
    (materials) => {
      materials.preload();
      const loader = new OBJLoader();
      loader.setMaterials(materials);
      loadObj(loader);
    },
    undefined,
    () => loadObj(new OBJLoader())
  );
} else {
  loadObj(new OBJLoader());
}

// ----------------------------------------------------
// HOTSPOT INTERACTION (smooth hover)
// ----------------------------------------------------
renderer.domElement.addEventListener("pointermove", (e) => {
  const hit = hotspotSystem.onPointerMove(e);

  // Only react to hover CHANGES (no per-frame scale mutations here)
  if (hit === hoveredHotspot) return;

  // hover-off previous
  if (hoveredHotspot) {
    hoveredHotspot.userData.targetScale = hoveredHotspot.userData.baseScale;
  }

  // hover-on new
  if (hit) {
    hit.userData.targetScale = hit.userData.baseScale * HOVER_SCALE_MULT;
  }

  hoveredHotspot = hit;
});

renderer.domElement.addEventListener("pointerleave", () => {
  // Reset when leaving canvas
  if (hoveredHotspot) {
    hoveredHotspot.userData.targetScale = hoveredHotspot.userData.baseScale;
  }
  hoveredHotspot = null;
});

renderer.domElement.addEventListener("pointerdown", (e) => {
  hotspotSystem.onPointerDown(e, (h) => {
    console.log("Hotspot clicked:", h.userData);
  });
});

// ----------------------------------------------------
// RENDER LOOP
// ----------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  // Smooth hotspot scale animation
  hotspotSystem.hotspots.forEach((h) => {
    const base = h.userData.baseScale;
    const target = h.userData.targetScale ?? base;
    const current = h.scale.x;
    const next = THREE.MathUtils.lerp(current, target, HOVER_LERP);
    h.scale.setScalar(next);
  });

  controls.update();
  renderer.render(scene, camera);
}
animate();
