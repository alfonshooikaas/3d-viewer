// main.js — Scene + UI + Hotspots orchestrator (FINAL)

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

let hoveredHotspot = null; // 🔑 stable hover state

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
// CENTER + FRAME MODEL
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
