// main.js — Full interactive viewer with hotspots + mesh focus + cursor + 3D tooltip

import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

import { createUI } from "./ui.js";
import { createHotspotSystem } from "./hotspots.js";
import { createHotspotTooltip } from "./tooltips.js";

/* -------------------------------------------------- */
/* FILES */
/* -------------------------------------------------- */
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl";

/* -------------------------------------------------- */
/* PARAMETERS (extended – driven by UI) */
/* -------------------------------------------------- */
export const params = {
  // scene
  background: "#FFE8E8",
  toneMapping: "ACES",
  exposure: 1.45,

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

  // hotspots
  hotspotDotSize: 1.0,
  hotspotDotOpacity: 1.0,
  hotspotDotColor: "#E1FF00",
  hotspotPinRadius: 1.0,
  hotspotPinLength: 1.0,
  hotspotHoverScale: 1.25,

  // tooltip
  tooltipOpacity: 0.85,
  tooltipBlur: 16,
  tooltipRadius: 14,
  tooltipTextColor: "#000000",

  // mesh hover
  meshDimOpacity: 0.85,
  meshHoverDarken: 0.9,
  meshOpacityLerp: 0.12,
};

/* -------------------------------------------------- */
/* DOM / SCENE */
/* -------------------------------------------------- */
const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e9);
camera.position.set(0, 1, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
container.appendChild(renderer.domElement);

function setCursor(type) {
  renderer.domElement.style.cursor = type;
}

// Tooltip (HTML, anchored to 3D)
const tooltip = createHotspotTooltip({ camera, renderer, params });

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.dampingFactor = 0.08;

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

/* -------------------------------------------------- */
/* LIGHTS */
/* -------------------------------------------------- */
const ambient = new THREE.AmbientLight(0xffffff, 1);
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
const key = new THREE.DirectionalLight(0xffffff, 1);
scene.add(ambient, hemi, key);

/* -------------------------------------------------- */
/* MODEL */
/* -------------------------------------------------- */
const pivot = new THREE.Group();
scene.add(pivot);

let loadedObj = null;

/* -------------------------------------------------- */
/* HOTSPOTS */
/* -------------------------------------------------- */
const hotspotSystem = createHotspotSystem({
  pivot,
  camera,
  domElement: renderer.domElement,
});

let hoveredHotspot = null;
const HOVER_LERP = 0.15;

/* -------------------------------------------------- */
/* MESH INTERACTION */
/* -------------------------------------------------- */
let modelMeshes = [];
let hoveredMesh = null;
let lockedMesh = null;

const meshRaycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();

/* -------------------------------------------------- */
/* LOOK */
/* -------------------------------------------------- */
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

/* -------------------------------------------------- */
/* CENTER */
/* -------------------------------------------------- */
function centerAndFrame(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!maxDim) return maxDim;

  pivot.position.set(-center.x, -center.y, -center.z);

  const dist =
    (maxDim / 2) /
    Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
    1.6;

  camera.position.set(0, maxDim * 0.22, dist);
  controls.target.set(0, 0, 0);
  controls.update();
  return maxDim;
}

/* -------------------------------------------------- */
/* LOAD MODEL */
/* -------------------------------------------------- */
function loadObj(loader) {
  loader.load(OBJ_FILE, (obj) => {
    pivot.clear();
    loadedObj = obj;
    pivot.add(obj);
    applyLook();

    modelMeshes = [];
    obj.traverse((m) => {
      if (m.isMesh && m.material?.color) {
        modelMeshes.push(m);
        m.userData.originalColor = m.material.color.clone();
        m.userData.originalOpacity = m.material.opacity ?? 1;
        m.material.transparent = true;
        m.userData.targetOpacity = m.userData.originalOpacity;
      }
    });

    requestAnimationFrame(() => {
      const size = centerAndFrame(obj);

      hotspotSystem.clearHotspots();

      const BASE = size * 0.02 * params.hotspotDotSize;

      hotspotSystem.addHotspot(new THREE.Vector3(0, 0, size * 0.3), {
        label: "Feature",
        lineLength: size * 0.03 * params.hotspotPinLength,
        pinRadius: size * 0.0025 * params.hotspotPinRadius,
        color: params.hotspotDotColor,
        opacity: params.hotspotDotOpacity,
      });

      hotspotSystem.hotspots.forEach((h) => {
        h.userData.baseScale = BASE;
        h.userData.targetScale = BASE;
        h.scale.setScalar(BASE);
      });

      createUI({ params, applyLook, refit: () => centerAndFrame(obj) });
    });
  });
}

if (MTL_FILE) {
  new MTLLoader().load(MTL_FILE, (mats) => {
    mats.preload();
    const l = new OBJLoader();
    l.setMaterials(mats);
    loadObj(l);
  });
} else {
  loadObj(new OBJLoader());
}

/* -------------------------------------------------- */
/* POINTER MOVE */
/* -------------------------------------------------- */
renderer.domElement.addEventListener("pointermove", (e) => {
  const hitHotspot = hotspotSystem.onPointerMove(e);

  if (!tooltip.isLocked()) {
    hitHotspot ? tooltip.show(hitHotspot) : tooltip.hide();
  }

  if (hitHotspot !== hoveredHotspot) {
    if (hoveredHotspot)
      hoveredHotspot.userData.targetScale =
        hoveredHotspot.userData.baseScale;

    if (hitHotspot)
      hitHotspot.userData.targetScale =
        hitHotspot.userData.baseScale * params.hotspotHoverScale;

    hoveredHotspot = hitHotspot;
  }

  if (lockedMesh) {
    setCursor(hitHotspot ? "pointer" : "default");
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  meshRaycaster.setFromCamera(mouseNDC, camera);
  hoveredMesh = meshRaycaster.intersectObjects(modelMeshes)[0]?.object || null;

  setCursor(hitHotspot || hoveredMesh ? "pointer" : "default");
});

renderer.domElement.addEventListener("pointerleave", () => {
  setCursor("default");
  if (!tooltip.isLocked()) tooltip.hide();
});

/* -------------------------------------------------- */
/* CLICK TO LOCK TOOLTIP */
/* -------------------------------------------------- */
renderer.domElement.addEventListener("pointerdown", (e) => {
  const hitHotspot = hotspotSystem.onPointerDown(e);
  if (hitHotspot) tooltip.lock(hitHotspot);
});

/* -------------------------------------------------- */
/* RENDER LOOP */
/* -------------------------------------------------- */
function animate() {
  requestAnimationFrame(animate);

  modelMeshes.forEach((m) => {
    m.material.opacity = THREE.MathUtils.lerp(
      m.material.opacity,
      m.userData.targetOpacity,
      params.meshOpacityLerp
    );
  });

  hotspotSystem.hotspots.forEach((h) => {
    const base = h.userData.baseScale;
    const target = h.userData.targetScale ?? base;
    h.scale.setScalar(THREE.MathUtils.lerp(h.scale.x, target, HOVER_LERP));
  });

  tooltip.update();
  controls.update();
  renderer.render(scene, camera);
}
animate();
