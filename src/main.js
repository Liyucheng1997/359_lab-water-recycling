import * as THREE from 'three';
import { createEnv } from './core/env.js';
import { SURFACE, PIPE_SHELLS } from './core/mats.js';
import { waterTime } from './core/water.js';
import { buildTerrain } from './world/terrain.js';
import { buildCity } from './world/city.js';
import { buildSewer } from './world/sewer.js';
import { buildWWTP } from './world/wwtp.js';
import { buildSludge } from './world/sludge.js';
import { buildDWTP } from './world/dwtp.js';
import { FLOWS, TRACER_PTS } from './flow/paths.js';
import { FlowSystem, Tracer, Bubbles } from './flow/particles.js';
import { STAGES, OVERVIEW, stageById } from './data/stages.js';
import { createUI } from './ui/ui.js';

const env = createEnv(document.getElementById('viewport'));
const { scene, camera, controls, composer, labelRenderer } = env;
const ctx = { anim: [], bubbles: [], pickables: [] };

// ── 构建场景 ──
buildTerrain(scene, ctx);
buildCity(scene, ctx);
buildSewer(scene, ctx);
buildWWTP(scene, ctx);
buildSludge(scene, ctx);
buildDWTP(scene, ctx);
const flows = new FlowSystem(FLOWS, scene);
const tracer = new Tracer(TRACER_PTS, scene);
const bubbles = new Bubbles(ctx.bubbles, scene);

// 追踪路径中每个工艺阶段的起点（用于底部时间轴）
const LOOP = STAGES.filter((s) => s.id !== 'sludge');
const stageStart = LOOP.map((s) => Math.max(0, tracer.path.st.indexOf(s.id)) / (tracer.path.N - 1));
function timelinePos(p) {
  for (let k = LOOP.length - 1; k >= 0; k--) {
    if (p >= stageStart[k]) {
      const next = k + 1 < LOOP.length ? stageStart[k + 1] : 1;
      if (k === LOOP.length - 1) return 1;
      return (k + (p - stageStart[k]) / Math.max(1e-6, next - stageStart[k])) / (LOOP.length - 1);
    }
  }
  return 0;
}

// ── 状态 ──
const state = { playing: true, speed: 6, follow: false, tour: false, tourT: 0, userGround: 1, ground: 1, groundTarget: 1, labels: true };
let fly = null;

function flyTo(p, t, dur = 1.9) {
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t), k: 0, dur };
}

function setGroundTarget(v) { state.groundTarget = v; ui.setGround(v); }

function select(id, { flyCam = true } = {}) {
  ui.setActive(id);
  const s = stageById[id];
  if (!s) return;
  if (flyCam && !state.follow) flyTo(s.cam.p, s.cam.t);
  setGroundTarget(s.xray ?? state.userGround);
}

function overview() {
  setFollow(false); setTour(false);
  ui.setActive(null);
  setGroundTarget(state.userGround);
  flyTo(OVERVIEW.p, OVERVIEW.t, 2.2);
}

function setFollow(on) {
  state.follow = on; ui.setFollow(on);
  if (on) {
    setTour(false);
    const p = tracer.pos;
    flyTo([p.x + 14, p.y + 10, p.z + 18], [p.x, p.y, p.z], 1.4);
    select(tracer.stage, { flyCam: false });
  }
}
function setTour(on) {
  state.tour = on; ui.setTour(on); state.tourT = 0;
  if (on) {
    if (state.follow) setFollow(false);
    const cur = STAGES.findIndex((s) => s.id === ui.active);
    select(STAGES[(cur + 1) % STAGES.length].id);
  }
}

const ui = createUI({
  onSelect: (id) => { if (state.follow) { tracer.jumpToStage(id); } select(id); },
  onPlay: () => { state.playing = !state.playing; ui.setPlaying(state.playing); },
  onSpeed: (v) => { state.speed = v; },
  onFollow: () => setFollow(!state.follow),
  onTour: () => setTour(!state.tour),
  onGround: (v) => { state.userGround = v; state.groundTarget = v; },
  onPipes: (on) => {
    for (const m of PIPE_SHELLS) { m.opacity = on ? m.userData.baseOpacity : 1; m.transparent = on; m.depthWrite = !on; m.needsUpdate = true; }
  },
  onLabels: (on) => { state.labels = on; labelRenderer.domElement.querySelectorAll('.lbl').forEach((l) => (l.style.visibility = on ? '' : 'hidden')); },
  onOverview: overview,
});

// ── 交互：点击设施/标签 ──
const ray = new THREE.Raycaster();
const down = new THREE.Vector2();
const el = labelRenderer.domElement;
el.addEventListener('pointerdown', (e) => down.set(e.clientX, e.clientY));
el.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || e.button !== 0) return;
  const lbl = e.target.closest?.('.lbl');
  if (lbl) { select(lbl.dataset.stage); return; }
  const r = el.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects(ctx.pickables, true)[0];
  if (!hit) return;
  let o = hit.object; while (o && !o.userData.stage) o = o.parent;
  if (o) { setTour(false); select(o.userData.stage); }
});
controls.addEventListener('start', () => { fly = null; if (state.tour) setTour(false); });

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const i = STAGES.findIndex((s) => s.id === ui.active);
  if (e.key === 'ArrowRight') select(STAGES[(i + 1) % STAGES.length].id);
  else if (e.key === 'ArrowLeft') select(STAGES[(i - 1 + STAGES.length) % STAGES.length].id);
  else if (e.key === ' ') { e.preventDefault(); state.playing = !state.playing; ui.setPlaying(state.playing); }
  else if (e.key === 'f' || e.key === 'F') setFollow(!state.follow);
  else if (e.key === 't' || e.key === 'T') setTour(!state.tour);
  else if (e.key === 'Escape') overview();
});

// ── 标签疏密控制 ──
const labels = [];
scene.traverse((o) => { if (o.isCSS2DObject) labels.push(o); });
const _wp = new THREE.Vector3();
function declutter() {
  for (const l of labels) {
    const d = camera.position.distanceTo(l.getWorldPosition(_wp));
    const c = l.element.classList;
    const sub = c.contains('sub'), site = c.contains('site');
    c.toggle('hide', sub ? d > 95 : site ? d < 50 || d > 650 : d > 900);
    if (!sub && !site) c.toggle('compact', d > 240 && !c.contains('active'));
  }
}

// ── 地表透明度 ──
function applyGround(v) {
  const t = v < 0.995;
  for (const m of SURFACE) {
    if (m.transparent !== t) { m.transparent = t; m.depthWrite = !t; m.needsUpdate = true; }
    m.opacity = v;
  }
}

// ── 主循环 ──
const clock = new THREE.Clock();
let t = 0, frame = 0, lastTracerStage = null;
camera.position.set(330, 420, 520);
flyTo(OVERVIEW.p, OVERVIEW.t, 3.2);

env.renderer.setAnimationLoop(() => tick(Math.min(clock.getDelta(), 0.05)));
function tick(dt) {
  {
    t += dt; waterTime.value = t;
    for (const f of ctx.anim) f(t, dt);
    const sp = state.playing ? state.speed : 0;
    flows.update(dt, sp);
    tracer.update(dt, sp);
    bubbles.update(dt, t);

    if (fly) {
      fly.k += dt / fly.dur;
      const k = Math.min(1, fly.k), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(fly.p0, fly.p1, e);
      camera.position.y += Math.sin(e * Math.PI) * fly.p0.distanceTo(fly.p1) * 0.12;
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (k >= 1) fly = null;
    } else if (state.follow) {
      const d = tracer.pos.clone().sub(controls.target);
      const k = 1 - Math.exp(-dt * 5);
      controls.target.addScaledVector(d, k);
      camera.position.addScaledVector(d, k);
    }

    if (tracer.stage !== lastTracerStage) {
      lastTracerStage = tracer.stage;
      ui.setTracerStage(tracer.stage);
      if (state.follow) select(tracer.stage, { flyCam: false });
    }
    ui.setDrop(timelinePos(tracer.progress()), tracer.q);

    if (state.tour) {
      state.tourT += dt;
      if (state.tourT > 9) {
        state.tourT = 0;
        const i = STAGES.findIndex((s) => s.id === ui.active);
        select(STAGES[(i + 1) % STAGES.length].id);
      }
    }

    if (Math.abs(state.ground - state.groundTarget) > 0.002) {
      state.ground += (state.groundTarget - state.ground) * (1 - Math.exp(-dt * 4));
      applyGround(state.ground);
    }

    controls.update();
    composer.render();
    labelRenderer.render(scene, camera);
    if (frame++ % 8 === 0) declutter();
    if (frame === 3) document.getElementById('loading').classList.add('done');
  }
}

// 调试入口
window.__app = {
  scene, camera, controls, select, tracer, state, renderer: env.renderer,
  step(dt = 1 / 60, n = 1) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) tick(dt);
    env.renderer.getContext().finish();
    return (performance.now() - t0) / n;
  },
};
