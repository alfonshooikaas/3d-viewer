import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const container = document.getElementById("app");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f2f2);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0, 1, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(3, 5, 2);
scene.add(dir);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

function resize() {
  // IMPORTANT: read size from the container that has a real height (100vh)
  const w = container.clientWidth;
  const h = container.clientHeight;

  // Guard against 0×0
  if (w === 0 || h === 0) return;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const loader = new GLTFLoader();
loader.load("./model.glb", (gltf) => {
  const model = gltf.scene;
  scene.add(model);

  // Center model + frame camera
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();

  model.position.sub(center);

  camera.position.set(0, size * 0.2, size * 0.6);
  controls.target.set(0, 0, 0);
  controls.update();

  resize(); // in case layout changed
}, undefined, console.error);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
