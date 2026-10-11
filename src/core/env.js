import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createEnv(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const pr = Math.min(window.devicePixelRatio, 1.75);
  renderer.setPixelRatio(pr);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe0ee);
  scene.fog = new THREE.Fog(0xcfe0ee, 520, 1300);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  // 天空穹顶
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x4f8fd0) }, mid: { value: new THREE.Color(0xbcd7ee) }, bot: { value: new THREE.Color(0xe9eef2) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.6)) : mix(mid, bot, pow(-h, 0.5));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xe3f0ff, 0x6b5a40, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(260, 420, 170);
  sun.target.position.set(20, 0, -30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -270; sc.right = 270; sc.top = 200; sc.bottom = -200; sc.near = 50; sc.far = 1100;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);

  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.3, 4000);
  camera.position.set(80, 260, 300);

  const controls = new OrbitControls(camera, labelRenderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.6;
  controls.minDistance = 2.5;
  controls.maxDistance = 1000;
  controls.target.set(15, 0, -30);
  controls.screenSpacePanning = true;

  const rt = new THREE.WebGLRenderTarget(container.clientWidth * pr, container.clientHeight * pr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.32, 0.45, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h); labelRenderer.setSize(w, h); composer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, controls, composer, labelRenderer, sun, bloom };
}
