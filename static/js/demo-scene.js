import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function disposeModel(model) {
  const resources = new Set();
  model.traverse((node) => {
    if (!node.isMesh) return;
    resources.add(node.geometry);
    if (node.isSkinnedMesh) resources.add(node.skeleton);
    for (const material of [node.material].flat()) {
      resources.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) resources.add(value);
      }
    }
  });
  for (const resource of resources) resource.dispose();
}

export function createDemoScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 80);
  camera.position.set(0, 0.6, 1);
  scene.add(new THREE.HemisphereLight(0xf5f9ff, 0xb2a6a3, 2.1));
  const key = new THREE.DirectionalLight(0xfff4e9, 2.5);
  key.position.set(-2, 4, 2);
  scene.add(key);

  const orbit = new OrbitControls(camera, canvas);
  orbit.minDistance = 0.25;
  orbit.maxDistance = 15;
  orbit.maxPolarAngle = Math.PI * 0.49;
  orbit.listenToKeyEvents(canvas);
  // A vertical touch gesture can still scroll the page.
  canvas.style.touchAction = 'pan-y';
  function render() {
    renderer.render(scene, camera);
  }
  orbit.addEventListener('change', render);
  const resize = new ResizeObserver(() => {
    const {clientWidth: width, clientHeight: height} = canvas;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  });
  resize.observe(canvas);

  const loader = new GLTFLoader();
  let model;
  let mixer;
  let action;
  let patches;

  return {
    load: (url) => loader.loadAsync(url),
    dispose: disposeModel,
    clear() {
      if (model) {
        mixer.stopAllAction();
        mixer.uncacheRoot(model);
        scene.remove(model);
        disposeModel(model);
        model = null;
      }
      if (patches) {
        patches.dispose();
        patches = null;
      }
      render();
    },
    setModel(asset, clip) {
      model = asset;
      // Animated skinned meshes move well beyond their first-frame bounds.
      model.traverse((node) => { if (node.isSkinnedMesh) node.frustumCulled = false; });
      scene.add(model);
      mixer = new THREE.AnimationMixer(model);
      action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    },
    reset(demo) {
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const target = demo.cameraTarget?.split(/\s+/).map(parseFloat);
      if (target?.length === 3 && target.every(Number.isFinite)) center.fromArray(target);
      const size = bounds.getBoundingSphere(new THREE.Sphere()).radius;
      const [theta, phi, radius] = (demo.cameraOrbit || '').split(/\s+/).map(parseFloat);
      const zoom = (radius > 0 ? radius : Math.max(0.5, 4 * size)) / Math.min(camera.aspect, 1);
      orbit.target.copy(center);
      camera.position.setFromSphericalCoords(zoom, THREE.MathUtils.degToRad(phi || 65),
                                            THREE.MathUtils.degToRad(theta || 0)).add(center);
      orbit.update();
      render();
    },
    setTime(time) {
      const contact = patches?.draw(time);
      action.paused = false;
      mixer.setTime(contact?.time ?? time);
      render();
      return contact?.present;
    },
    async loadPatches(url, signal) {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Patch request failed (${response.status})`);
      // Support both precompressed sidecars and hosts that serve them with Content-Encoding.
      let data = await response.arrayBuffer();
      const signature = new Uint8Array(data, 0, Math.min(2, data.byteLength));
      if (signature[0] === 31 && signature[1] === 139) {
        data = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      }
      return createPatches(scene, data);
    },
    setPatches(layer) {
      patches = layer;
      patches.attach();
    },
    showPatches(time) {
      patches.visible = true;
      return this.setTime(time);
    },
    hidePatches(time) {
      if (patches) patches.visible = false;
      this.setTime(time);
    },
  };
}

function createPatches(scene, data) {
  const header = new DataView(data);
  if (header.getUint32(0, false) !== 0x49504331) throw new Error('Invalid contact patch file');
  const count = header.getUint32(4, true);
  if (!count || 36 + count * 8 > data.byteLength) throw new Error('Invalid patch frame count');
  const origin = new Float32Array(data, 8, 3);
  const step = new Float32Array(data, 20, 3);
  const times = new Float32Array(data, 32, count);
  const offsets = new Uint32Array(data, 32 + count * 4, count + 1);
  if (36 + 8 * count + offsets[count] * 20 !== data.byteLength) throw new Error('Invalid patch offsets');
  const triangles = new Uint16Array(data, 36 + count * 8);
  let maximum = 0;
  for (let i = 1; i <= count; i++) {
    if (offsets[i] < offsets[i - 1] || offsets[i] > offsets[count]) throw new Error('Invalid patch range');
    maximum = Math.max(maximum, offsets[i] - offsets[i - 1]);
  }
  const positions = new THREE.BufferAttribute(new Float32Array(maximum * 9), 3).setUsage(THREE.DynamicDrawUsage);
  const colors = new THREE.BufferAttribute(new Float32Array(maximum * 9), 3).setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', positions);
  geometry.setAttribute('color', colors);
  geometry.setDrawRange(0, 0);
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  const shallow = new THREE.Color('#fff284');
  const deep = new THREE.Color('#db2153');
  const color = new THREE.Color();
  let frame = -1;

  function draw(time) {
    if (!mesh.visible) return;
    // Hold each measured frame until the next sample. Triangle topology can change.
    let low = 0;
    let high = count - 1;
    while (low < high) {
      const mid = (low + high + 1) >>> 1;
      if (times[mid] <= time + 1e-6) low = mid;
      else high = mid - 1;
    }
    const first = offsets[low];
    const length = offsets[low + 1] - first;
    const sample = { time: times[low], present: length > 0 };
    if (low === frame) return sample;
    frame = low;
    for (let i = 0; i < length; i++) {
      const source = (first + i) * 10;
      color.copy(shallow).lerp(deep, Math.min(1, triangles[source + 9] / 2500));
      for (let corner = 0; corner < 3; corner++) {
        const at = source + corner * 3;
        const x = origin[0] + step[0] * triangles[at];
        const y = origin[1] + step[1] * triangles[at + 1];
        const z = origin[2] + step[2] * triangles[at + 2];
        positions.setXYZ(i * 3 + corner, x, z, -y);
        colors.setXYZ(i * 3 + corner, color.r, color.g, color.b);
      }
    }
    geometry.setDrawRange(0, length * 3);
    positions.needsUpdate = colors.needsUpdate = true;
    return sample;
  }

  return {
    attach() { scene.add(mesh); mesh.visible = false; },
    set visible(value) { mesh.visible = value; },
    draw,
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
