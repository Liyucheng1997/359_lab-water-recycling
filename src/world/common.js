import * as THREE from 'three';
import { M } from '../core/mats.js';
import { railing, mesh, Batcher } from '../core/geo.js';
import { waterMat, waterVolMat, waterPlane, waterDisc } from '../core/water.js';

/**
 * 矩形水池
 * o: x0,x1,z0,z1,h,t,base, glass:前墙(z1)为剖切玻璃, skip:[...'x0','x1','z0','z1'], rail, water:{y,color,deep,foam,chop,opacity,vol,volOpacity,flow}
 */
export function rectTank(B, g, o) {
  const { x0, x1, z0, z1, h = 4.5, t = 0.4, base = 0, glass = false, skip = [] } = o;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  B.boxB(W, 0.3, D, M.concreteDark, cx, base, cz);
  if (!skip.includes('x0')) B.boxB(t, h, D, M.concrete, x0 + t / 2, base, cz);
  if (!skip.includes('x1')) B.boxB(t, h, D, M.concrete, x1 - t / 2, base, cz);
  if (!skip.includes('z0')) B.boxB(W, h, t, M.concrete, cx, base, z0 + t / 2);
  if (glass) {
    B.boxB(W - 2 * t, h - 0.02, 0.06, M.glass, cx, base, z1 - 0.03);
    B.boxB(W, 0.25, t, M.concrete, cx, base + h - 0.25, z1 - t / 2);
    for (const x of [x0 + t / 2, x1 - t / 2]) B.boxB(t + 0.02, h, 0.05, M.concreteCut, x, base, z1 + 0.005);
    // 剖切标示（橙色边框）
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(W - 2 * t, h - 0.25)), new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.8 }));
    e.position.set(cx, base + (h - 0.25) / 2, z1 + 0.01); g.add(e);
  } else if (!skip.includes('z1')) B.boxB(W, h, t, M.concrete, cx, base, z1 - t / 2);
  const ix0 = x0 + (skip.includes('x0') ? 0 : t), ix1 = x1 - (skip.includes('x1') ? 0 : t);
  const iz0 = z0 + (skip.includes('z0') ? 0 : t), iz1 = z1 - (glass ? 0.06 : skip.includes('z1') ? 0 : t);
  const inner = { x0: ix0, x1: ix1, z0: iz0, z1: iz1, cx: (ix0 + ix1) / 2, cz: (iz0 + iz1) / 2, w: ix1 - ix0, d: iz1 - iz0 };
  if (o.water) {
    const w = o.water;
    const wm = waterMat(w.color, { deep: w.deep, foam: w.foam ?? 0, chop: w.chop ?? 1, opacity: w.opacity ?? 0.9, flow: w.flow });
    waterPlane(inner.w, inner.d, wm, inner.cx, w.y, inner.cz, g);
    if (w.vol || glass) {
      const vm = waterVolMat(w.volColor ?? w.color, w.volOpacity ?? 0.45);
      const vb = new THREE.Mesh(new THREE.BoxGeometry(inner.w - 0.02, w.y - base - 0.3, inner.d - 0.02), vm);
      vb.position.set(inner.cx, base + 0.3 + (w.y - base - 0.3) / 2, inner.cz); vb.renderOrder = 2;
      g.add(vb);
    }
  }
  if (o.rail) railing(B, [[x0 + 0.1, base + h, z0 + 0.1], [x1 - 0.1, base + h, z0 + 0.1], [x1 - 0.1, base + h, z1 - 0.1], [x0 + 0.1, base + h, z1 - 0.1]], M.railing, { closed: true });
  return inner;
}

const innerWall = M.concrete.clone(); innerWall.side = THREE.BackSide;
const steelDS = M.steel.clone(); steelDS.side = THREE.DoubleSide;

/**
 * 辐流式沉淀池（中心进水、周边出水，半桥式刮泥机旋转）
 */
export function clarifier(g, ctx, { cx, cz, r, water, clear, deep, speed = 0.05 }) {
  const B = new Batcher();
  const H = 4.5;
  mesh(new THREE.CylinderGeometry(r, r, H, 80, 1, true), M.concrete, cx, H / 2, cz, g);
  mesh(new THREE.CylinderGeometry(r - 0.4, r - 0.4, H, 80, 1, true), innerWall, cx, H / 2, cz, g);
  const top = mesh(new THREE.RingGeometry(r - 0.4, r, 80), M.concrete, cx, H, cz, g); top.rotation.x = -Math.PI / 2;
  const fl = mesh(new THREE.CircleGeometry(r - 0.4, 64), M.concreteDark, cx, 0.3, cz, g); fl.rotation.x = -Math.PI / 2;
  // 出水堰槽
  mesh(new THREE.CylinderGeometry(r - 1.4, r - 1.4, 1.3, 80, 1, true), steelDS, cx, 3.6, cz, g);
  const tb = mesh(new THREE.RingGeometry(r - 1.4, r - 0.4, 80), M.concreteDark, cx, 2.95, cz, g); tb.rotation.x = -Math.PI / 2;
  // V 形堰板齿
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    B.add(new THREE.ConeGeometry(0.07, 0.12, 3), M.steel, [cx + Math.cos(a) * (r - 1.42), 4.22, cz + Math.sin(a) * (r - 1.42)], [Math.PI, 0, 0]);
  }
  waterDisc(r - 1.4, waterMat(water, { deep, chop: 0.6, opacity: 0.92 }), cx, 4.05, cz, g);
  waterDisc(r - 0.4, waterMat(clear, { chop: 0.4, opacity: 0.88 }), cx, 3.9, cz, g, r - 1.4);
  // 中心柱、稳流筒
  B.cyl(0.9, 5.8, M.concrete, cx, 2.9, cz, 20);
  mesh(new THREE.CylinderGeometry(2.2, 2.2, 2.2, 40, 1, true), steelDS, cx, 3.5, cz, g);
  railing(B, Array.from({ length: 64 }, (_, i) => { const a = (i / 64) * Math.PI * 2; return [cx + Math.cos(a) * (r - 0.15), H, cz + Math.sin(a) * (r - 0.15)]; }), M.railing, { closed: true, spacing: 1.8 });
  // 出水井
  B.boxB(2, H - 0.4, 2.8, M.concrete, cx + r + 0.9, 0, cz);
  B.flush(g);

  // 旋转桥
  const bridge = new THREE.Group(); bridge.position.set(cx, 0, cz); g.add(bridge);
  const BB = new Batcher();
  const L = r + 0.4, y = 5.8;
  for (const s of [-0.55, 0.55]) BB.bar([0.6, y, s], [L, y, s], 0.5, 0.18, M.galv);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.6, 1.0), M.grating); deck.rotation.x = -Math.PI / 2; deck.position.set((L + 0.6) / 2, y + 0.26, 0); bridge.add(deck);
  for (const s of [-0.6, 0.6]) railing(BB, [[0.8, y + 0.26, s], [L, y + 0.26, s]], M.railing, { spacing: 1.5 });
  BB.boxB(1.2, 1.0, 1.4, M.blueMachine, L - 0.3, y - 1.1, 0);
  BB.cyl(0.35, 0.3, M.rubber, r - 0.2, H + 0.35, 0, 16, [0, 0, Math.PI / 2]);
  BB.boxB(1.4, 0.9, 1.2, M.greyMachine, 1.2, y + 0.26, 0);
  for (const x of [3, r * 0.55, r - 1.8]) BB.beam([x, y - 0.2, 0], [x, 0.9, 0], 0.06, M.galv);
  BB.bar([1.0, 0.7, 0], [r - 0.8, 0.45, 0], 0.15, 0.15, M.galv);
  for (let x = 1.6; x < r - 1; x += 1.2) BB.add(new THREE.BoxGeometry(0.9, 0.35, 0.05), M.steelDark, [x, 0.55, 0.3], [0, Math.PI / 5, 0]);
  BB.boxB(0.12, 0.6, 3, M.steel, r - 2.2, 3.8, 1.2);
  BB.flush(bridge);
  ctx.anim.push((t) => { bridge.rotation.y = -t * speed; });
}

/** 简易钢结构厂房（柱 + 檩条 + 半透明屋面） */
export function shed(B, { x0, x1, z0, z1, h, roof = M.polycarb, cladding = null, glassFront = false }) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const cols = [];
  for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 6))) for (const z of [z0, z1]) cols.push([x, z]);
  for (const [x, z] of cols) B.boxB(0.35, h, 0.35, M.steelDark, x, 0, z);
  for (const z of [z0, z1]) B.bar([x0, h, z], [x1, h, z], 0.3, 0.45, M.steelDark);
  for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 6))) B.bar([x, h, z0], [x, h, z1], 0.25, 0.35, M.steelDark);
  B.boxB(x1 - x0 + 0.6, 0.06, z1 - z0 + 0.6, roof, cx, h + 0.25, cz);
  if (cladding) {
    B.boxB(x1 - x0, h, 0.12, cladding, cx, 0, z0);
    B.boxB(0.12, h, z1 - z0, cladding, x0, 0, cz);
    B.boxB(0.12, h, z1 - z0, cladding, x1, 0, cz);
  }
  if (glassFront) B.boxB(x1 - x0, h, 0.06, M.glass, cx, 0, z1);
}
