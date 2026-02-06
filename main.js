import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

// ---------- FILES ----------
const OBJ_FILE = "model.obj";
const MTL_FILE = "model.mtl"; // "" if none
const TEXTURE_PATH = "";      // e.g. "textures/" if .mtl uses bare filenames
// --------------------------

// ---------- DEFAULT LOOK (editable via UI) ----------
const params = {
  // scene / renderer
  background: "#FFE8E8",
  toneMapping: "ACES",          // "ACES" | "NONE"
  exposure: 1.42,
  physicallyCorrectLights: false,

  // lights
  ambientIntensity: 0.75,
  ambientColor: "#FFE8E8",

  hemiIntensity: 1.05,
  hemiSky: "#FFFFFF",
  hemiGround: "#FFE8E8",

  keyIntensity: 0.45,
  keyColor: "#FFFFFF",
  keyPosX: 1.2,
  keyPosY: 2.0,
  keyPosZ: 1.4,

  // material override
  overrideMaterials: false,
  overrideRoughness: 0.9,
  overrideMetalness: 0.0,

  // framing
  placeOnGround: false,
};
// -----------------------------------------------

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

/** ---------- Scene setup ---------- **/
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e9);
camera.position.set(0, 1, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;

/** Canvas sizing **/
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

/** ---------- Lights ---------- **/
const ambient = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1);
scene.add(key);

/** ---------- Model container + state ---------- **/
const pivot = new THREE.Group();
scene.add(pivot);

let loadedObj = null;
let meshList = []; // { name, mesh }
const perMeshColors = new Map(); // mesh.uuid -> "#RRGGBB"

/** Utility: apply renderer + scene params **/
function applyLook() {
  scene.background = new THREE.Color(params.background);

  renderer.physicallyCorrectLights = !!params.physicallyCorrectLights;
  if (params.toneMapping === "ACES") renderer.toneMapping = THREE.ACESFilmicToneMapping;
  else renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = params.exposure;

  ambient.color = new THREE.Color(params.ambientColor);
  ambient.intensity = params.ambientIntensity;

  hemi.color = new THREE.Color(params.hemiSky);
  hemi.groundColor = new THREE.Color(params.hemiGround);
  hemi.intensity = params.hemiIntensity;

  key.color = new THREE.Color(params.keyColor);
  key.intensity = params.keyIntensity;
  key.position.set(params.keyPosX, params.keyPosY, params.keyPosZ);

  // update materials if we have a model
  if (loadedObj) {
    applyMaterials(loadedObj);
  }
}

/** Utility: build a stable, nice name for meshes **/
function niceMeshName(mesh, i) {
  const n = (mesh.name || "").trim();
  if (n) return n;
  // sometimes OBJLoader makes empty names; use a deterministic fallback
  return `Mesh ${String(i + 1).padStart(2, "0")}`;
}

/** Utility: traverse model, collect meshes **/
function collectMeshes(root) {
  meshList = [];
  let idx = 0;

  root.traverse((o) => {
    if (!o.isMesh) return;
    meshList.push({ name: niceMeshName(o, idx), mesh: o });
    idx += 1;
  });

  // sort by name for UI stability
  meshList.sort((a, b) => a.name.localeCompare(b.name));
}

/** Materials: store originals so we can toggle override on/off **/
const originalMaterials = new WeakMap(); // mesh -> material

function applyMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;

    // store original once
    if (!originalMaterials.has(o)) originalMaterials.set(o, o.material);

    // decide base material
    if (params.overrideMaterials) {
      // Use a consistent PBR material for a Blender-like look
      const existingColor =
        perMeshColors.get(o.uuid) ||
        (o.material && o.material.color ? `#${o.material.color.getHexString()}` : null) ||
        "#cccccc";

      o.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(existingColor),
        roughness: params.overrideRoughness,
        metalness: params.overrideMetalness,
      });
    } else {
      // restore original
      const orig = originalMaterials.get(o);
      if (orig) o.material = orig;

      // apply per-mesh color override on top, if set
      const hex = perMeshColors.get(o.uuid);
      if (hex && o.material && o.material.color) {
        o.material.color = new THREE.Color(hex);
      }

      // gently nudge toward matte (helps MTL materials that look harsh/dark)
      if (o.material) {
        if ("metalness" in o.material) o.material.metalness = 0.0;
        if ("roughness" in o.material) o.material.roughness = Math.max(0.75, o.material.roughness ?? 0.9);
        o.material.needsUpdate = true;
      }
    }
  });
}

/** Center + frame **/
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

  const box3 = new THREE.Box3().setFromObject(obj);
  const size3 = box3.getSize(new THREE.Vector3());
  const maxDim3 = Math.max(size3.x, size3.y, size3.z);

  const target = new THREE.Vector3(0, 0, 0);
  if (params.placeOnGround) target.y = (size3.y || maxDim3) * 0.45;

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
}

/** Load model **/
function loadObj(objLoader) {
  objLoader.load(
    OBJ_FILE,
    (obj) => {
      pivot.clear();
      loadedObj = obj;
      pivot.add(obj);

      collectMeshes(obj);
      applyLook();
      applyMaterials(obj);

      requestAnimationFrame(() => {
        centerAndFrame(obj);
        // build UI mesh dropdown once we know meshes
        buildMeshControls();
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
      loadObj(objLoader);
    },
    undefined,
    (err) => {
      console.warn("MTL failed; loading OBJ without materials:", err);
      loadObj(new OBJLoader());
    }
  );
} else {
  loadObj(new OBJLoader());
}

/** Hotkeys **/
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "f" && loadedObj) centerAndFrame(loadedObj);
});

/** Render loop **/
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
applyLook();
animate();

/** ---------- Floating Material-style UI (draggable + collapsible) ---------- **/

const ui = createFloatingPanel({
  title: "Viewer Controls",
  collapsedTitle: "Controls",
  initialX: 16,
  initialY: 16,
});

const sections = {
  look: ui.section("Look"),
  lights: ui.section("Lights"),
  material: ui.section("Material"),
  meshes: ui.section("Mesh Colors"),
  frame: ui.section("Framing"),
};

// Look controls
sections.look.addColor("Background", params.background, (v) => {
  params.background = v; applyLook();
});

sections.look.addSelect("Tone mapping", params.toneMapping, ["ACES", "NONE"], (v) => {
  params.toneMapping = v; applyLook();
});

sections.look.addSlider("Exposure", params.exposure, 0.6, 2.0, 0.01, (v) => {
  params.exposure = v; applyLook();
});

sections.look.addToggle("Physically correct lights", params.physicallyCorrectLights, (v) => {
  params.physicallyCorrectLights = v; applyLook();
});

// Light controls
sections.lights.addColor("Ambient color", params.ambientColor, (v) => {
  params.ambientColor = v; applyLook();
});
sections.lights.addSlider("Ambient intensity", params.ambientIntensity, 0, 2.0, 0.01, (v) => {
  params.ambientIntensity = v; applyLook();
});

sections.lights.addColor("Hemi sky", params.hemiSky, (v) => {
  params.hemiSky = v; applyLook();
});
sections.lights.addColor("Hemi ground", params.hemiGround, (v) => {
  params.hemiGround = v; applyLook();
});
sections.lights.addSlider("Hemi intensity", params.hemiIntensity, 0, 2.0, 0.01, (v) => {
  params.hemiIntensity = v; applyLook();
});

sections.lights.addColor("Key color", params.keyColor, (v) => {
  params.keyColor = v; applyLook();
});
sections.lights.addSlider("Key intensity", params.keyIntensity, 0, 2.0, 0.01, (v) => {
  params.keyIntensity = v; applyLook();
});
sections.lights.addSlider("Key pos X", params.keyPosX, -10, 10, 0.1, (v) => {
  params.keyPosX = v; applyLook();
});
sections.lights.addSlider("Key pos Y", params.keyPosY, -10, 10, 0.1, (v) => {
  params.keyPosY = v; applyLook();
});
sections.lights.addSlider("Key pos Z", params.keyPosZ, -10, 10, 0.1, (v) => {
  params.keyPosZ = v; applyLook();
});

// Material controls
sections.material.addToggle("Override materials (Standard)", params.overrideMaterials, (v) => {
  params.overrideMaterials = v; applyLook();
});
sections.material.addSlider("Roughness", params.overrideRoughness, 0, 1, 0.01, (v) => {
  params.overrideRoughness = v; applyLook();
});
sections.material.addSlider("Metalness", params.overrideMetalness, 0, 1, 0.01, (v) => {
  params.overrideMetalness = v; applyLook();
});

// Framing controls
sections.frame.addToggle("Place on ground", params.placeOnGround, (v) => {
  params.placeOnGround = v;
  if (loadedObj) centerAndFrame(loadedObj);
});
sections.frame.addButton("Refit (F)", () => loadedObj && centerAndFrame(loadedObj));

// Mesh color controls (built after model load)
let meshUIBuilt = false;
function buildMeshControls() {
  if (meshUIBuilt) return;
  meshUIBuilt = true;

  if (!meshList.length) {
    sections.meshes.addNote("No meshes found.");
    return;
  }

  // Dropdown to select mesh
  const meshNames = meshList.map((m) => m.name);
  let currentName = meshNames[0];
  let currentMesh = meshList[0].mesh;

  const row = sections.meshes.addSelect("Mesh", currentName, meshNames, (name) => {
    currentName = name;
    currentMesh = meshList.find((m) => m.name === name)?.mesh || currentMesh;
    // update color input to reflect current mesh
    const hex =
      perMeshColors.get(currentMesh.uuid) ||
      (currentMesh.material?.color ? `#${currentMesh.material.color.getHexString()}` : "#cccccc");
    colorCtrl.set(hex);
  });

  // Color picker for selected mesh
  const initialHex =
    (currentMesh.material?.color ? `#${currentMesh.material.color.getHexString()}` : "#cccccc");

  const colorCtrl = sections.meshes.addColor("Color", initialHex, (hex) => {
    if (!currentMesh) return;
    perMeshColors.set(currentMesh.uuid, hex);
    applyLook();
  });

  sections.meshes.addButton("Clear mesh color override", () => {
    if (!currentMesh) return;
    perMeshColors.delete(currentMesh.uuid);
    applyLook();
    const hex =
      (currentMesh.material?.color ? `#${currentMesh.material.color.getHexString()}` : "#cccccc");
    colorCtrl.set(hex);
  });

  sections.meshes.addNote("Tip: rename objects in Blender for nicer mesh names.");
}

/** ---------- UI helper implementation ---------- **/

function createFloatingPanel({ title, collapsedTitle, initialX, initialY }) {
  injectPanelStylesOnce();

  const panel = document.createElement("div");
  panel.className = "mv-panel";
  panel.style.transform = `translate(${initialX}px, ${initialY}px)`;

  const header = document.createElement("div");
  header.className = "mv-header";

  const titleEl = document.createElement("div");
  titleEl.className = "mv-title";
  titleEl.textContent = title;

  const right = document.createElement("div");
  right.className = "mv-header-right";

  const collapseBtn = document.createElement("button");
  collapseBtn.className = "mv-iconbtn";
  collapseBtn.title = "Collapse/expand";
  collapseBtn.innerHTML = "▾";

  right.appendChild(collapseBtn);
  header.appendChild(titleEl);
  header.appendChild(right);

  const body = document.createElement("div");
  body.className = "mv-body";

  panel.appendChild(header);
  panel.appendChild(body);
  document.body.appendChild(panel);

  // state
  let collapsed = false;

  collapseBtn.addEventListener("click", () => {
    collapsed = !collapsed;
    panel.classList.toggle("mv-collapsed", collapsed);
    collapseBtn.innerHTML = collapsed ? "▸" : "▾";
    titleEl.textContent = collapsed ? collapsedTitle : title;
  });

  // draggable by header
  makeDraggable(panel, header);

  function section(label) {
    const s = document.createElement("div");
    s.className = "mv-section";

    const h = document.createElement("div");
    h.className = "mv-section-title";
    h.textContent = label;

    const c = document.createElement("div");
    c.className = "mv-section-content";

    s.appendChild(h);
    s.appendChild(c);
    body.appendChild(s);

    return createControlsAPI(c);
  }

  return { panel, section };
}

function createControlsAPI(containerEl) {
  function row(labelText) {
    const r = document.createElement("div");
    r.className = "mv-row";

    const l = document.createElement("div");
    l.className = "mv-label";
    l.textContent = labelText;

    const v = document.createElement("div");
    v.className = "mv-value";

    r.appendChild(l);
    r.appendChild(v);
    containerEl.appendChild(r);

    return { r, l, v };
  }

  function addSlider(label, initial, min, max, step, onChange) {
    const { v } = row(label);

    const wrap = document.createElement("div");
    wrap.className = "mv-slider-wrap";

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);

    const num = document.createElement("input");
    num.type = "number";
    num.className = "mv-number";
    num.min = String(min);
    num.max = String(max);
    num.step = String(step);
    num.value = String(initial);

    function setVal(x) {
      const val = clamp(Number(x), min, max);
      input.value = String(val);
      num.value = String(val);
      onChange(val);
    }

    input.addEventListener("input", () => setVal(input.value));
    num.addEventListener("input", () => setVal(num.value));

    wrap.appendChild(input);
    wrap.appendChild(num);
    v.appendChild(wrap);

    return {
      set: (val) => setVal(val),
    };
  }

  function addColor(label, initial, onChange) {
    const { v } = row(label);

    const input = document.createElement("input");
    input.type = "color";
    input.value = normalizeHex(initial);

    const text = document.createElement("input");
    text.type = "text";
    text.className = "mv-text";
    text.value = normalizeHex(initial);

    function setVal(hex) {
      const h = normalizeHex(hex);
      input.value = h;
      text.value = h;
      onChange(h);
    }

    input.addEventListener("input", () => setVal(input.value));
    text.addEventListener("change", () => setVal(text.value));

    const wrap = document.createElement("div");
    wrap.className = "mv-inline";
    wrap.appendChild(input);
    wrap.appendChild(text);
    v.appendChild(wrap);

    return {
      set: (hex) => setVal(hex),
    };
  }

  function addToggle(label, initial, onChange) {
    const { v } = row(label);

    const wrap = document.createElement("label");
    wrap.className = "mv-switch";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!initial;

    const track = document.createElement("span");
    track.className = "mv-switch-track";

    wrap.appendChild(input);
    wrap.appendChild(track);
    v.appendChild(wrap);

    input.addEventListener("change", () => onChange(input.checked));
    return {
      set: (checked) => {
        input.checked = !!checked;
        onChange(input.checked);
      },
    };
  }

  function addSelect(label, initial, options, onChange) {
    const { v } = row(label);

    const sel = document.createElement("select");
    sel.className = "mv-select";

    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      sel.appendChild(o);
    }
    sel.value = initial;

    sel.addEventListener("change", () => onChange(sel.value));
    v.appendChild(sel);

    return {
      set: (val) => {
        sel.value = val;
        onChange(sel.value);
      },
    };
  }

  function addButton(label, onClick) {
    const { v } = row(label);
    const btn = document.createElement("button");
    btn.className = "mv-btn";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    v.appendChild(btn);
  }

  function addNote(text) {
    const note = document.createElement("div");
    note.className = "mv-note";
    note.textContent = text;
    containerEl.appendChild(note);
  }

  return { addSlider, addColor, addToggle, addSelect, addButton, addNote };
}

function makeDraggable(panelEl, handleEl) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let baseY = 0;

  // store pos in dataset so collapse doesn't reset
  function getPos() {
    return {
      x: Number(panelEl.dataset.x || 16),
      y: Number(panelEl.dataset.y || 16),
    };
  }
  function setPos(x, y) {
    panelEl.dataset.x = String(x);
    panelEl.dataset.y = String(y);
    panelEl.style.transform = `translate(${x}px, ${y}px)`;
  }

  // initialize from computed transform
  setPos(Number(panelEl.dataset.x || 16), Number(panelEl.dataset.y || 16));

  handleEl.style.cursor = "grab";

  handleEl.addEventListener("pointerdown", (e) => {
    dragging = true;
    handleEl.setPointerCapture(e.pointerId);
    handleEl.style.cursor = "grabbing";
    const pos = getPos();
    baseX = pos.x;
    baseY = pos.y;
    startX = e.clientX;
    startY = e.clientY;
    e.preventDefault();
  });

  handleEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // clamp to viewport so it can't get lost
    const maxX = window.innerWidth - 64;
    const maxY = window.innerHeight - 64;

    setPos(clamp(baseX + dx, 0, maxX), clamp(baseY + dy, 0, maxY));
  });

  handleEl.addEventListener("pointerup", () => {
    dragging = false;
    handleEl.style.cursor = "grab";
  });
}

let panelStylesInjected = false;
function injectPanelStylesOnce() {
  if (panelStylesInjected) return;
  panelStylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .mv-panel{
      position: fixed;
      top: 0; left: 0;
      z-index: 99999;
      width: 320px;
      max-width: calc(100vw - 24px);
      background: rgba(255,255,255,0.92);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.18);
      border: 1px solid rgba(0,0,0,0.06);
      overflow: hidden;
      user-select: none;
      font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
      color: #111;
    }
    .mv-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding: 10px 12px;
      background: rgba(255,255,255,0.75);
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }
    .mv-title{
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.2px;
    }
    .mv-header-right{ display:flex; gap: 6px; align-items:center; }
    .mv-iconbtn{
      width: 30px;
      height: 30px;
      border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.10);
      background: rgba(255,255,255,0.9);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
    }
    .mv-body{
      padding: 10px 12px 12px;
      max-height: min(70vh, 640px);
      overflow:auto;
    }
    .mv-collapsed .mv-body{
      display:none;
    }

    .mv-section{ margin-bottom: 10px; }
    .mv-section-title{
      font-size: 12px;
      font-weight: 700;
      margin: 6px 0 8px;
      color: rgba(0,0,0,0.65);
      text-transform: none;
    }
    .mv-row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
      padding: 6px 0;
    }
    .mv-label{
      font-size: 12px;
      color: rgba(0,0,0,0.70);
      flex: 1 1 auto;
    }
    .mv-value{
      flex: 0 0 160px;
      display:flex;
      justify-content:flex-end;
      align-items:center;
      gap: 8px;
    }
    .mv-inline{ display:flex; align-items:center; gap:8px; }
    .mv-text{
      width: 92px;
      padding: 6px 8px;
      border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.10);
      background: rgba(255,255,255,0.95);
      font-size: 12px;
    }
    .mv-number{
      width: 74px;
      padding: 6px 8px;
      border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.10);
      background: rgba(255,255,255,0.95);
      font-size: 12px;
    }
    .mv-select{
      width: 160px;
      padding: 7px 10px;
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.10);
      background: rgba(255,255,255,0.95);
      font-size: 12px;
    }
    .mv-slider-wrap{
      display:flex;
      align-items:center;
      gap: 8px;
    }
    input[type="range"]{
      width: 120px;
      accent-color: #4f46e5; /* tasteful, close to material-ish */
    }
    .mv-btn{
      width: 160px;
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.10);
      background: rgba(255,255,255,0.95);
      cursor: pointer;
      font-size: 12px;
    }
    .mv-note{
      font-size: 11px;
      color: rgba(0,0,0,0.55);
      padding: 6px 0 2px;
    }

    /* Switch */
    .mv-switch{ position:relative; display:inline-flex; align-items:center; }
    .mv-switch input{ display:none; }
    .mv-switch-track{
      width: 44px; height: 26px;
      border-radius: 999px;
      background: rgba(0,0,0,0.15);
      position: relative;
      transition: all .2s ease;
      border: 1px solid rgba(0,0,0,0.08);
    }
    .mv-switch-track::after{
      content:"";
      position:absolute;
      top: 3px; left: 3px;
      width: 20px; height: 20px;
      border-radius: 999px;
      background: white;
      box-shadow: 0 3px 10px rgba(0,0,0,0.18);
      transition: all .2s ease;
    }
    .mv-switch input:checked + .mv-switch-track{
      background: rgba(79,70,229,0.65);
    }
    .mv-switch input:checked + .mv-switch-track::after{
      left: 21px;
    }
  `;
  document.head.appendChild(style);
}

function clamp(x, a, b) {
  return Math.min(b, Math.max(a, x));
}
function normalizeHex(h) {
  if (!h) return "#000000";
  let s = String(h).trim();
  if (!s.startsWith("#")) s = `#${s}`;
  if (s.length === 9) s = s.slice(0, 7); // drop alpha if someone pastes #RRGGBBAA
  if (s.length === 4) {
    // #rgb -> #rrggbb
    s = "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  }
  return s.slice(0, 7);
}
