import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PIPE } from './mats.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _s = new THREE.Vector3(), _p = new THREE.Vector3();
export const UP = new THREE.Vector3(0, 1, 0);

export const toV = (p) => (p.isVector3 ? p.clone() : Array.isArray(p) ? new THREE.Vector3(p[0], p[1], p[2]) : new THREE.Vector3(p.x, p.y, p.z));

const unitCache = {};
export const unitBox = () => (unitCache.box ??= new THREE.BoxGeometry(1, 1, 1));
export const unitCyl = (n = 8) => (unitCache['c' + n] ??= new THREE.CylinderGeometry(1, 1, 1, n));
export const unitSphere = () => (unitCache.sph ??= new THREE.SphereGeometry(1, 12, 8));

/** 静态几何合批：按材质合并，减少 draw call */
export class Batcher {
  constructor() { this.groups = new Map(); }
  add(geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
    _e.set(rot[0], rot[1], rot[2]); _q.setFromEuler(_e);
    _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(scl[0], scl[1], scl[2]));
    this.addMatrix(geo, mat, _m);
  }
  addMatrix(geo, mat, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    let list = this.groups.get(mat);
    if (!list) { list = []; this.groups.set(mat, list); }
    list.push(g);
  }
  box(w, h, d, mat, x, y, z, ry = 0) { this.add(unitBox(), mat, [x, y, z], [0, ry, 0], [w, h, d]); }
  /** 底部对齐的盒子 */
  boxB(w, h, d, mat, x, y0, z, ry = 0) { this.box(w, h, d, mat, x, y0 + h / 2, z, ry); }
  cyl(r, h, mat, x, y, z, n = 12, rot = [0, 0, 0]) { this.add(unitCyl(n), mat, [x, y, z], rot, [r, h, r]); }
  sphere(r, mat, x, y, z) { this.add(unitSphere(), mat, [x, y, z], [0, 0, 0], [r, r, r]); }
  beam(a, b, r, mat, n = 6) {
    const A = toV(a), B = toV(b);
    const dir = new THREE.Vector3().subVectors(B, A); const L = dir.length(); if (L < 1e-4) return;
    _q.setFromUnitVectors(UP, dir.normalize());
    _m.compose(_p.addVectors(A, B).multiplyScalar(0.5), _q, _s.set(r, L, r));
    this.addMatrix(unitCyl(n), mat, _m);
  }
  /** 方钢/工字梁近似 */
  bar(a, b, w, h, mat) {
    const A = toV(a), B = toV(b);
    const dir = new THREE.Vector3().subVectors(B, A); const L = dir.length(); if (L < 1e-4) return;
    _q.setFromUnitVectors(UP, dir.normalize());
    _m.compose(_p.addVectors(A, B).multiplyScalar(0.5), _q, _s.set(w, L, h));
    this.addMatrix(unitBox(), mat, _m);
  }
  flush(parent, { cast = true, receive = true } = {}) {
    const out = [];
    for (const [mat, list] of this.groups) {
      const g = mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      if (!g) continue;
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = cast && !mat.transparent; mesh.receiveShadow = receive;
      parent.add(mesh); out.push(mesh);
    }
    this.groups.clear();
    return out;
  }
}

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast && !mat.transparent; m.receiveShadow = receive;
  parent?.add(m);
  return m;
}
export const boxMesh = (w, h, d, mat, x, y0, z, parent, o) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, parent, o);

/** 折线 → 带圆角弯头的 CurvePath */
export function roundedPath(points, radius = 1) {
  const pts = points.map(toV);
  const path = new THREE.CurvePath();
  let prev = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const d1 = b.clone().sub(a), d2 = c.clone().sub(b);
    const l1 = d1.length(), l2 = d2.length();
    if (l1 < 1e-5 || l2 < 1e-5) continue;
    d1.divideScalar(l1); d2.divideScalar(l2);
    const r = Math.min(radius, l1 * 0.49, l2 * 0.49);
    if (r < 1e-3 || d1.dot(d2) > 0.9995) {
      if (prev.distanceTo(b) > 1e-4) path.add(new THREE.LineCurve3(prev, b.clone()));
      prev = b.clone(); continue;
    }
    const p1 = b.clone().addScaledVector(d1, -r);
    const p2 = b.clone().addScaledVector(d2, r);
    if (prev.distanceTo(p1) > 1e-4) path.add(new THREE.LineCurve3(prev, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    prev = p2;
  }
  const last = pts[pts.length - 1];
  if (prev.distanceTo(last) > 1e-4) path.add(new THREE.LineCurve3(prev, last.clone()));
  return path;
}

/**
 * 管道：半透明管壁 + 法兰 + 地上支墩
 */
export function pipe(parent, points, r, mat, { bend, flanges = true, flangeEvery = 6, supports = false, radial = 14, batch } = {}) {
  const pts = points.map(toV);
  const br = bend ?? Math.max(r * 2.2, 0.25);
  const path = roundedPath(pts, br);
  const L = path.getLength();
  const geo = new THREE.TubeGeometry(path, Math.max(6, Math.ceil(L / 0.6)), r, radial, false);
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  m.castShadow = !mat.transparent;
  parent.add(m);
  const own = !batch; const B = batch ?? new Batcher();
  const flGeo = unitCyl(radial + 2);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dir = b.clone().sub(a); const len = dir.length(); if (len < 0.05) continue; dir.divideScalar(len);
    const s0 = i === 0 ? 0.12 : Math.min(br, len * 0.49) + 0.12;
    const s1 = i === pts.length - 2 ? len - 0.12 : len - Math.min(br, len * 0.49) - 0.12;
    if (flanges && s1 > s0) {
      const n = Math.max(1, Math.round((s1 - s0) / flangeEvery));
      _q.setFromUnitVectors(UP, dir);
      for (let k = 0; k <= n; k++) {
        const d = s0 + (s1 - s0) * (k / n);
        _m.compose(_p.copy(a).addScaledVector(dir, d), _q, _s.set(r * 1.28, Math.max(0.05, r * 0.22), r * 1.28));
        B.addMatrix(flGeo, PIPE.flange, _m);
      }
    }
    if (supports && Math.abs(dir.y) < 0.05 && a.y - r > 0.25) {
      const n = Math.floor(len / 4.5);
      for (let k = 1; k <= Math.max(1, n); k++) {
        const p = a.clone().addScaledVector(dir, (len * k) / (Math.max(1, n) + 1));
        const h = p.y - r;
        B.boxB(r * 2.2, h, 0.35 + r, PIPE.flange, p.x, 0, p.z, Math.atan2(dir.x, dir.z));
      }
    }
  }
  if (own) B.flush(parent);
  return { mesh: m, path };
}

/** 栏杆：立柱 + 扶手 + 中横杆 */
export function railing(B, points, mat, { h = 1.1, spacing = 1.6, r = 0.035, closed = false } = {}) {
  const pts = points.map(toV);
  if (closed) pts.push(pts[0].clone());
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = a.distanceTo(b); if (len < 0.05) continue;
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k < n; k++) {
      const p = a.clone().lerp(b, k / n);
      B.beam(p, p.clone().setY(p.y + h), r, mat);
    }
    const up = (v, dy) => v.clone().setY(v.y + dy);
    B.beam(up(a, h), up(b, h), r * 0.9, mat);
    B.beam(up(a, h * 0.5), up(b, h * 0.5), r * 0.7, mat);
  }
  if (!closed) { const e = pts[pts.length - 1]; B.beam(e, e.clone().setY(e.y + h), r, mat); }
}

export function ringPoints(cx, y, cz, r, n = 32, a0 = 0, a1 = Math.PI * 2) {
  const out = [];
  const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
  const cnt = full ? n : n + 1;
  for (let i = 0; i < cnt; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
  }
  return out;
}

/** 确定性随机数 */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** 为盒体设置以米为单位的立面 UV（4m×3m 一个纹理单元） */
export function facadeBox(w, h, d, uw = 4, uh = 3) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // 面顺序: px nx py ny pz nz，每面 4 顶点
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = dims[f];
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * fw / uw, uv.getY(idx) * fh / uh);
    }
  }
  return g;
}

/** 文字标注（CSS2D） */
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
export function makeLabel(text, num, stageId, pos) {
  const el = document.createElement('div');
  el.className = 'lbl';
  el.dataset.stage = stageId;
  el.innerHTML = (num != null ? `<span class="n">${num}</span>` : '') + `<span class="t">${text}</span>`;
  const o = new CSS2DObject(el);
  o.position.set(pos[0], pos[1], pos[2]);
  return o;
}
