import * as THREE from 'three';
import { roundedPath } from '../core/geo.js';

// 清洁度 → 颜色（污水棕 → 混合液土黄 → 清水青 → 饮用水蓝）
const PAL = [
  [0.0, 0x4a3218], [0.1, 0x6b4a26], [0.22, 0x86683c], [0.36, 0x8e8450],
  [0.5, 0x7fa07a], [0.62, 0x5fb8ae], [0.74, 0x45b1d6], [0.88, 0x2f8fff], [1.0, 0x3fb8ff],
].map(([q, c]) => [q, new THREE.Color(c)]);
export function qColor(q, out = new THREE.Color()) {
  q = Math.min(1, Math.max(0, q));
  for (let i = 1; i < PAL.length; i++) {
    if (q <= PAL[i][0]) {
      const [q0, c0] = PAL[i - 1], [q1, c1] = PAL[i];
      return out.copy(c0).lerp(c1, (q - q0) / (q1 - q0));
    }
  }
  return out.copy(PAL[PAL.length - 1][1]);
}
export const qCss = (q) => '#' + qColor(q).getHexString(THREE.SRGBColorSpace);

/** 沿折线采样的流动路径（预计算查表，运行时 O(1) 取样） */
export class FlowPath {
  constructor(pts, opt = {}) {
    this.opt = opt;
    const n = pts.length;
    const cum = [0];
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1], b = pts[i];
      cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
    }
    const raw = cum[n - 1];
    const fill = (key, def) => {
      const def_ = pts.map((p, i) => (p[key] != null ? i : -1)).filter((i) => i >= 0);
      if (!def_.length) return pts.map(() => def);
      return pts.map((p, i) => {
        if (p[key] != null) return p[key];
        let lo = -1, hi = -1;
        for (const j of def_) { if (j < i) lo = j; if (j > i && hi < 0) hi = j; }
        if (lo < 0) return pts[hi][key];
        if (hi < 0) return pts[lo][key];
        const f = (cum[i] - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
        return pts[lo][key] + (pts[hi][key] - pts[lo][key]) * f;
      });
    };
    const Q = fill('q', opt.q ?? 0.5), S = fill('s', opt.spread ?? 0.2), K = fill('k', 1);
    const FL = pts.map((p) => (p.flat ? 1 : 0));
    const ST = []; let cur = null;
    for (const p of pts) { if (p.st) cur = p.st; ST.push(cur); }

    this.curve = roundedPath(pts, opt.bend ?? 0.6);
    this.L = this.curve.getLength();
    const N = Math.max(2, Math.ceil(this.L / 0.3) + 1);
    this.N = N; this.step = this.L / (N - 1);
    this.pos = new Float32Array(N * 3); this.side = new Float32Array(N * 3); this.up = new Float32Array(N * 3);
    this.q = new Float32Array(N); this.s = new Float32Array(N); this.k = new Float32Array(N); this.flat = new Float32Array(N);
    this.st = new Array(N);
    const p = new THREE.Vector3(), t = new THREE.Vector3(), sd = new THREE.Vector3(), up = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      this.curve.getPointAt(u, p); this.curve.getTangentAt(u, t);
      sd.crossVectors(t, Y); if (sd.lengthSq() < 1e-6) sd.set(1, 0, 0); sd.normalize();
      up.crossVectors(sd, t).normalize();
      p.toArray(this.pos, i * 3); sd.toArray(this.side, i * 3); up.toArray(this.up, i * 3);
      const d = u * raw;
      while (j < n - 2 && cum[j + 1] < d) j++;
      const f = Math.min(1, Math.max(0, (d - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j])));
      this.q[i] = Q[j] + (Q[j + 1] - Q[j]) * f;
      this.s[i] = S[j] + (S[j + 1] - S[j]) * f;
      this.k[i] = K[j] + (K[j + 1] - K[j]) * f;
      this.flat[i] = FL[j] * FL[j + 1];
      this.st[i] = f > 0.999 ? ST[j + 1] : ST[j];
    }
  }
  index(d) { return Math.min(this.N - 1, Math.max(0, Math.round(d / this.step))); }
  /** 取样：带横向偏移 a(水平), b(竖直) ∈ [-1,1] */
  sample(d, a, b, out) {
    const x = Math.min(this.N - 1.001, Math.max(0, d / this.step));
    const i = Math.floor(x), f = x - i, i3 = i * 3, j3 = i3 + 3;
    const P = this.pos, S = this.side, U = this.up;
    const s = this.s[i] + (this.s[i + 1] - this.s[i]) * f;
    const fl = this.flat[i];
    const bb = fl > 0.5 ? 0 : b;
    out.x = P[i3] + (P[j3] - P[i3]) * f + (S[i3] * a + U[i3] * bb) * s;
    out.y = P[i3 + 1] + (P[j3 + 1] - P[i3 + 1]) * f + (S[i3 + 1] * a + U[i3 + 1] * bb) * s;
    out.z = P[i3 + 2] + (P[j3 + 2] - P[i3 + 2]) * f + (S[i3 + 2] * a + U[i3 + 2] * bb) * s;
    return out;
  }
}

function glowMaterial(base = 0.45) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.0 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * ${base.toFixed(2)};`);
  };
  return m;
}

/** 全部水流粒子：单个 InstancedMesh 渲染 */
export class FlowSystem {
  constructor(flows, parent) {
    this.paths = flows.map((f) => new FlowPath(f.pts, f));
    const counts = this.paths.map((p) => Math.max(2, Math.round(p.L * (p.opt.density ?? 1))));
    const total = counts.reduce((a, b) => a + b, 0);
    this.total = total;
    this.pi = new Uint16Array(total); this.d = new Float32Array(total);
    this.a = new Float32Array(total); this.b = new Float32Array(total); this.j = new Float32Array(total);
    let n = 0;
    counts.forEach((c, pi) => {
      const L = this.paths[pi].L;
      for (let i = 0; i < c; i++, n++) {
        this.pi[n] = pi; this.d[n] = (i + Math.random() * 0.8) / c * L;
        const r = Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
        this.a[n] = r * Math.cos(th); this.b[n] = r * Math.sin(th);
        this.j[n] = 0.85 + Math.random() * 0.3;
      }
    });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), glowMaterial(0.32), total);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.renderOrder = 1;
    this.mesh.setColorAt(0, new THREE.Color());
    parent.add(this.mesh);
    this._v = { x: 0, y: 0, z: 0 }; this._c = new THREE.Color();
    this.colorTick = 0;
    this.fixedColors = this.paths.map((p) => (p.opt.color != null ? new THREE.Color(p.opt.color) : null));
    this.update(0, 0);
  }
  update(dt, speed) {
    const M = this.mesh.instanceMatrix.array, C = this.mesh.instanceColor.array;
    const v = this._v, c = this._c;
    const doColor = (this.colorTick++ % 3) === 0;
    for (let n = 0; n < this.total; n++) {
      const P = this.paths[this.pi[n]];
      const i = P.index(this.d[n]);
      let d = this.d[n] + speed * (P.opt.speed ?? 1) * P.k[i] * this.j[n] * dt;
      if (d > P.L) d -= P.L;
      this.d[n] = d;
      P.sample(d, this.a[n], this.b[n], v);
      const s = (P.opt.size ?? 0.25);
      const o = n * 16;
      M[o] = s; M[o + 1] = 0; M[o + 2] = 0; M[o + 3] = 0;
      M[o + 4] = 0; M[o + 5] = s; M[o + 6] = 0; M[o + 7] = 0;
      M[o + 8] = 0; M[o + 9] = 0; M[o + 10] = s; M[o + 11] = 0;
      M[o + 12] = v.x; M[o + 13] = v.y; M[o + 14] = v.z; M[o + 15] = 1;
      if (doColor) {
        const fc = this.fixedColors[this.pi[n]];
        if (fc) c.copy(fc); else qColor(P.q[i], c);
        C[n * 3] = c.r; C[n * 3 + 1] = c.g; C[n * 3 + 2] = c.b;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (doColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** 追踪水滴：沿完整闭环运动的高亮水滴 + 拖尾 */
export class Tracer {
  constructor(pts, parent) {
    this.path = new FlowPath(pts, { bend: 0.5 });
    this.d = 0;
    this.group = new THREE.Group(); parent.add(this.group);
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), glowMaterial(1.6));
    this.core.material.color.set(0x8fe0ff);
    this.group.add(this.core);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9fe8ff, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0.85 }));
    this.halo.scale.set(3.2, 3.2, 1);
    this.halo.renderOrder = 10;
    this.group.add(this.halo);
    const TN = 90;
    this.trail = new Float32Array(TN * 3);
    const alpha = new Float32Array(TN); for (let i = 0; i < TN; i++) alpha[i] = 1 - i / TN;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.trail, 3));
    g.setAttribute('aA', new THREE.BufferAttribute(alpha, 1));
    this.trailMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x9fe8ff) }, uSize: { value: 0.55 } },
      vertexShader: `attribute float aA; varying float vA; uniform float uSize;
        void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uSize * (0.25 + aA) * (320.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor * 1.4, vA * (1.0 - d * 2.0)); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.trailMat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.lastTrail = 0;
    this.pos = new THREE.Vector3();
    this.stage = this.path.st[0];
    this.q = 1;
    this._c = new THREE.Color();
    this.sample();
    for (let i = 0; i < TN; i++) this.pos.toArray(this.trail, i * 3);
  }
  sample() {
    this.path.sample(this.d, 0, 0, this.pos);
    const i = this.path.index(this.d);
    this.stage = this.path.st[i]; this.q = this.path.q[i];
  }
  setVisible(v) { this.group.visible = v; }
  update(dt, speed) {
    const i = this.path.index(this.d);
    this.d += speed * 1.35 * Math.max(0.35, this.path.k[i]) * dt;
    if (this.d > this.path.L) this.d -= this.path.L;
    this.sample();
    this.core.position.copy(this.pos); this.halo.position.copy(this.pos);
    qColor(this.q, this._c);
    this.core.material.color.copy(this._c);
    this.halo.material.color.copy(this._c).lerp(new THREE.Color(1, 1, 1), 0.25);
    this.trailMat.uniforms.uColor.value.copy(this._c);
    if (Math.abs(this.d - this.lastTrail) > 0.35) {
      this.lastTrail = this.d;
      this.trail.copyWithin(3, 0, this.trail.length - 3);
      this.pos.toArray(this.trail, 0);
      this.points.geometry.attributes.position.needsUpdate = true;
    }
  }
  progress() { return this.d / this.path.L; }
  jumpToStage(st) {
    const i = this.path.st.indexOf(st);
    if (i >= 0) { this.d = i * this.path.step; this.sample(); for (let k = 0; k < this.trail.length; k += 3) this.pos.toArray(this.trail, k); this.points.geometry.attributes.position.needsUpdate = true; }
  }
}

/** 曝气气泡：在指定区域内上升 */
export class Bubbles {
  constructor(emitters, parent) {
    this.em = emitters;
    const total = emitters.reduce((s, e) => s + e.count, 0);
    this.total = total;
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xeef8ff, roughness: 0.1, metalness: 0.1, emissive: 0x334455 }), total);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false;
    parent.add(this.mesh);
    this.st = [];
    for (const e of emitters) for (let i = 0; i < e.count; i++) this.st.push(this.spawn(e, true));
    this.update(0);
  }
  spawn(e, init) {
    const x = e.x0 + Math.random() * (e.x1 - e.x0), z = e.z0 + Math.random() * (e.z1 - e.z0);
    return { e, x, z, y: init ? e.y0 + Math.random() * (e.y1 - e.y0) : e.y0, v: (e.speed ?? 1.2) * (0.7 + Math.random() * 0.6), r: (e.size ?? 0.07) * (0.6 + Math.random() * 0.8), ph: Math.random() * 6.28 };
  }
  update(dt, t = 0) {
    const M = this.mesh.instanceMatrix.array;
    for (let n = 0; n < this.total; n++) {
      let b = this.st[n];
      b.y += b.v * dt;
      if (b.y > b.e.y1) { b = this.st[n] = this.spawn(b.e, false); }
      const s = b.r * (1 + (b.y - b.e.y0) / (b.e.y1 - b.e.y0 + 1e-3) * 0.6);
      const o = n * 16;
      M[o] = s; M[o + 5] = s; M[o + 10] = s; M[o + 15] = 1;
      M[o + 12] = b.x + Math.sin(t * 3 + b.ph) * 0.06; M[o + 13] = b.y; M[o + 14] = b.z + Math.cos(t * 2.6 + b.ph) * 0.06;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
