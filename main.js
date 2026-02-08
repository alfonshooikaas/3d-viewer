// main.js — Full interactive viewer with hotspots + mesh focus + deselect button + cursor + 3D tooltip

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
/* PARAMETERS */
/* -------------------------------------------------- */
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

// Cursor helper
function setCursor(type) {
  renderer.domElement.style.cursor = type;
}

// ✅ Tooltip system (isolated)
const hotspotTooltip = createHotspotTooltip({ camera, renderer });

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
const HOVER_SCALE_MULT = 1.25;
const HOVER_LERP = 0.15;

/* -------------------------------------------------- */
/* MESH INTERACTION */
/* -------------------------------------------------- */
let modelMeshes = [];
let hoveredMesh = null;
let lockedMesh = null;

const meshRaycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();

const DIM_OPACITY = 0.85;
const OPACITY_LERP = 0.12;

/* -------------------------------------------------- */
/* UI: Mesh label */
/* -------------------------------------------------- */
const meshLabel = document.createElement("div");
meshLabel.style.cssText = `
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(0,0,0,.65);
  color: white;
  font: 12px system-ui;
  pointer-events: none;
  opacity: 0;
  transition: opacity .2s ease;
`;
document.body.appendChild(meshLabel);

function showMeshName(name) {
  meshLabel.textContent = name;
  meshLabel.style.opacity = "1";
}
function hideMeshName() {
  meshLabel.style.opacity = "0";
}

/* -------------------------------------------------- */
/* UI: Deselect button */
/* -------------------------------------------------- */
const deselectBtn = document.createElement("button");
deselectBtn.textContent = "Deselect";
deselectBtn.style.cssText = `
  position: fixed;
  bottom: 16px;
  right: 16px;
  padding: 8px 14px;
  border-radius: 999px;
  border: none;
  background: #111;
  color: white;
  font: 13px system-ui;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s ease;
`;
document.body.appendChild(deselectBtn);

function showDeselect() {
  deselectBtn.style.opacity = "1";
  deselectBtn.style.pointerEvents = "auto";
}
function hideDeselect() {
  deselectBtn.style.opacity = "0";
  deselectBtn.style.pointerEvents = "none";
}

deselectBtn.onclick = () => {
  lockedMesh = null;
  hoveredMesh = null;
  hideMeshName();
  hideDeselect();

  modelMeshes.forEach((m) => {
    m.userData.targetOpacity = m.userData.originalOpacity;
    m.material.color.copy(m.userData.originalColor);
  });

  setCursor("default");
};

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
      const BASE = size * 0.06;

      hotspotSystem.addHotspot(new THREE.Vector3(0, 0, size * 0.3), {
        label: "Feature",
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
  // --- Hotspots ---
  const hitHotspot = hotspotSystem.onPointerMove(e);

  if (hitHotspot !== hoveredHotspot) {
    if (hoveredHotspot) {
      hoveredHotspot.userData.targetScale = hoveredHotspot.userData.baseScale;
      hotspotTooltip.hide();
    }
    if (hitHotspot) {
      hitHotspot.userData.targetScale =
        hitHotspot.userData.baseScale * HOVER_SCALE_MULT;
      hotspotTooltip.show(hitHotspot, hitHotspot.userData.label || "");
    }
    hoveredHotspot = hitHotspot;
  }

  // If mesh is locked, still show pointer + tooltip over hotspots
  if (lockedMesh) {
    setCursor(hitHotspot ? "pointer" : "default");
    return;
  }

  // --- Mesh hover ---
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  meshRaycaster.setFromCamera(mouseNDC, camera);
  const hit = meshRaycaster.intersectObjects(modelMeshes)[0]?.object || null;

  if (hit !== hoveredMesh) {
    hoveredMesh = hit;

    if (hit) {
      showMeshName(hit.name || "Part");
      showDeselect();
      modelMeshes.forEach((m) => {
        m.userData.targetOpacity =
          m === hit ? m.userData.originalOpacity : DIM_OPACITY;
        m.material.color.copy(
          m.userData.originalColor.clone().multiplyScalar(m === hit ? 0.9 : 1)
        );
      });
    } else {
      hideMeshName();
      hideDeselect();
      modelMeshes.forEach((m) => {
        m.userData.targetOpacity = m.userData.originalOpacity;
        m.material.color.copy(m.userData.originalColor);
      });
    }
  }

  // --- Cursor feedback (pointer over hotspot OR mesh) ---
  setCursor(hitHotspot || hoveredMesh ? "pointer" : "default");
});

// Reset cursor + tooltip when leaving canvas
renderer.domElement.addEventListener("pointerleave", () => {
  setCursor("default");
  hotspotTooltip.hide();
});

/* -------------------------------------------------- */
/* CLICK TO LOCK */
/* -------------------------------------------------- */
renderer.domElement.addEventListener("pointerdown", () => {
  if (hoveredMesh) {
    lockedMesh = hoveredMesh;
    showDeselect();
  }
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
      OPACITY_LERP
    );
  });

  hotspotSystem.hotspots.forEach((h) => {
    const base = h.userData.baseScale;
    const target = h.userData.targetScale ?? base;
    h.scale.setScalar(THREE.MathUtils.lerp(h.scale.x, target, HOVER_LERP));
  });

  hotspotTooltip.update();

  controls.update();
  renderer.render(scene, camera);
}
animate();
