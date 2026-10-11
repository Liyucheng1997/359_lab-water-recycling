import * as THREE from 'three';
import { M, PIPE } from '../core/mats.js';
import { Batcher, pipe, mesh, makeLabel, railing, rng, unitCyl } from '../core/geo.js';
import { waterMat, waterPlane } from '../core/water.js';
import { A, RAS, WAS, P } from '../flow/paths.js';
import { rectTank, clarifier, shed } from './common.js';

const stageGroup = (scene, ctx, id) => {
  const g = new THREE.Group(); g.name = id; g.userData.stage = id; scene.add(g); ctx.pickables.push(g); return g;
};
const drawPiece = (g, piece, o = {}) => pipe(g, piece.pts, piece.pipe.r, PIPE[piece.pipe.kind], { supports: piece.pipe.supports, flangeEvery: 6, ...o });

export function buildWWTP(scene, ctx) {
  headworks(stageGroup(scene, ctx, 'headworks'), ctx);
  primary(stageGroup(scene, ctx, 'primary'), ctx);
  bio(stageGroup(scene, ctx, 'bio'), ctx);
  secondary(stageGroup(scene, ctx, 'secondary'), ctx);
  tertiary(stageGroup(scene, ctx, 'tertiary'), ctx);
  uv(stageGroup(scene, ctx, 'uv'), ctx);
  wetland(stageGroup(scene, ctx, 'wetland'), ctx);
  admin(scene);
}

// ─────────────── ④ 预处理：格栅 + 曝气沉砂池 ───────────────
function headworks(g, ctx) {
  const B = new Batcher();
  const sew = { color: 0x6b5232, deep: 0x3b2a16, chop: 1.2, opacity: 0.93 };
  rectTank(B, g, { x0: 6, x1: 10.2, z0: 7, z1: 13, h: 4.5, skip: ['x1'], water: { y: 3.65, ...sew, foam: 0.35 } });
  rectTank(B, g, { x0: 10, x1: 22.2, z0: 8.2, z1: 11.8, h: 4.5, skip: ['x0', 'x1'], water: { y: 3.65, ...sew, flow: [1.2, 0] } });
  const grit = rectTank(B, g, { x0: 22, x1: 38, z0: 7, z1: 13, h: 4.5, glass: true, water: { y: 3.65, color: 0x705838, deep: 0x40301a, foam: 0.5, chop: 1.4, volOpacity: 0.4 } });
  // 沉砂槽（斜底）
  B.add(new THREE.BoxGeometry(grit.w, 0.2, 3.6), M.concreteDark, [grit.cx, 0.9, 11.0], [0.45, 0, 0]);
  railing(B, [[6.1, 4.5, 7.1], [37.9, 4.5, 7.1]], M.railing);
  railing(B, [[22.1, 4.5, 12.9], [37.9, 4.5, 12.9]], M.railing);

  // 粗格栅（回转式，倾角 75°）
  const sx0 = 12.4, sx1 = 13.9, y0 = 0.4, y1 = 6.0;
  for (let z = 8.8; z <= 11.25; z += 0.18) B.bar([sx0, y0, z], [sx1, y1, z], 0.035, 0.08, M.steelDark);
  for (const z of [8.5, 11.5]) B.bar([sx0 - 0.1, y0, z], [sx1 + 0.1, y1 + 0.8, z], 0.2, 0.3, M.greenMachine);
  B.boxB(1.4, 1.1, 3.4, M.greenMachine, sx1 + 0.3, y1, 10);
  B.cyl(0.32, 0.8, M.blueMachine, sx1 + 0.3, y1 + 1.5, 11.2, 14, [Math.PI / 2, 0, 0]);
  // 齿耙（动画）
  const rake = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 2.8), M.orange); rake.castShadow = true; g.add(rake);
  ctx.anim.push((t) => {
    const f = (Math.sin(t * 0.6) + 1) / 2;
    rake.position.set(sx0 + (sx1 - sx0) * f + 0.15, y0 + (y1 - y0) * f, 10);
  });
  // 栅渣输送 + 渣斗
  B.bar([sx1 + 0.6, y1 - 0.2, 11.6], [sx1 + 0.6, 2.4, 15.3], 0.8, 0.4, M.greyMachine);
  B.boxB(2.2, 1.5, 2.6, M.greenMachine, sx1 + 0.6, 0, 16.1);
  B.boxB(2.0, 0.3, 2.4, M.sludge, sx1 + 0.6, 1.3, 16.1);

  // 细格栅：转鼓（倾角 35°）
  const drum = new THREE.Group(); drum.position.set(18.6, 2.55, 10); drum.rotation.z = -Math.PI / 2 + 0.61; g.add(drum);
  const spin = new THREE.Group(); drum.add(spin);
  const dm = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6.2, 40, 1, true), M.drumMesh); spin.add(dm);
  for (const y of [-3.1, -1, 1, 3.1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 40), M.steel); ring.rotation.x = Math.PI / 2; ring.position.y = y; spin.add(ring); }
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 5.5, 16), M.steel); screw.position.y = 5.8; drum.add(screw);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.9), M.blueMachine); head.position.y = 8.6; drum.add(head);
  ctx.anim.push((t) => { spin.rotation.y = t * 0.8; });
  B.boxB(2.0, 1.4, 2.4, M.greenMachine, 23.6, 0, 15.6);

  // 雨棚
  shed(B, { x0: 8.5, x1: 23.5, z0: 5.6, z1: 17.6, h: 9 });

  // 曝气沉砂：空气管 + 行车桥 + 砂水分离器
  pipe(g, [[30, 1.2, 15.2], [30, 5.2, 15.2], [30, 5.2, 7.3], [23, 5.2, 7.3], [37, 5.2, 7.3]], 0.15, PIPE.air, { flanges: false });
  for (let x = 23.5; x < 37; x += 2) B.beam([x, 5.2, 7.3], [x, 0.7, 7.6], 0.05, M.galv);
  B.boxB(2.4, 1.4, 1.6, M.blueMachine, 30, 0, 15.2);
  ctx.bubbles.push({ x0: 22.6, x1: 37.4, z0: 7.5, z1: 8.4, y0: 0.7, y1: 3.6, count: 260, size: 0.07, speed: 1.4 });
  const gb = new THREE.Group(); g.add(gb);
  const GB = new Batcher();
  for (const s of [-0.5, 0.5]) GB.bar([s, 4.8, 6.6], [s, 4.8, 13.4], 0.2, 0.35, M.galv);
  const gd = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 6.8), M.grating); gd.rotation.x = -Math.PI / 2; gd.position.set(0, 5.0, 10); gb.add(gd);
  railing(GB, [[-0.5, 5.0, 6.6], [-0.5, 5.0, 13.4]], M.railing); railing(GB, [[0.5, 5.0, 6.6], [0.5, 5.0, 13.4]], M.railing);
  GB.beam([0, 4.8, 11.3], [0, 0.8, 11.3], 0.12, M.blueMachine);
  GB.boxB(0.8, 0.8, 0.8, M.blueMachine, 0, 5.0, 8);
  GB.flush(gb);
  ctx.anim.push((t) => { gb.position.x = 30 + 6 * Math.sin(t * 0.12); });
  B.bar([38.8, 0.3, 5.4], [42.6, 4.2, 5.4], 0.7, 0.7, M.greenMachine);
  B.boxB(1.6, 1.2, 1.8, M.greenMachine, 43.4, 0, 5.4);
  B.flush(g);

  drawPiece(g, A.toPrimary);
  g.add(makeLabel('格栅与曝气沉砂池', 4, 'headworks', [22, 11, 10]));
}

// ─────────────── ⑤ 初沉池 ───────────────
function primary(g, ctx) {
  clarifier(g, ctx, { cx: 56, cz: 10, r: 11, water: 0x7a6440, deep: 0x4a3a22, clear: 0x8f8058, speed: 0.045 });
  drawPiece(g, A.toBio);
  g.add(makeLabel('初次沉淀池', 5, 'primary', [56, 9, 10]));
}

// ─────────────── ⑥ A²/O 生化池 ───────────────
function bio(g, ctx) {
  const B = new Batcher();
  const x0 = 74, x1 = 106, z0 = -2, z1 = 22, h = 5.6, t = 0.4, wy = 5.05;
  rectTank(B, g, { x0, x1, z0, z1, h, glass: true });
  // 廊道隔墙
  B.boxB(103.6 - 74.4, h, 0.3, M.concrete, (74.4 + 103.6) / 2, 0, 6);
  B.boxB(105.6 - 76.4, h, 0.3, M.concrete, (76.4 + 105.6) / 2, 0, 14);
  // 三条廊道：厌氧 / 缺氧 / 好氧
  const lanes = [
    { z0: -1.6, z1: 5.85, color: 0x4d3a22, deep: 0x2a1d0e, foam: 0.05, chop: 0.5 },
    { z0: 6.15, z1: 13.85, color: 0x5c4628, deep: 0x33240f, foam: 0.12, chop: 0.7 },
    { z0: 14.15, z1: 21.94, color: 0x7a6038, deep: 0x46341b, foam: 0.85, chop: 1.8 },
  ];
  for (const [i, L] of lanes.entries()) {
    const wm = waterMat(L.color, { deep: L.deep, foam: L.foam, chop: L.chop, opacity: 0.93, flow: [i === 1 ? -0.4 : 0.4, 0] });
    waterPlane(31.2, L.z1 - L.z0, wm, 90, wy, (L.z0 + L.z1) / 2, g);
  }
  const vol = new THREE.Mesh(new THREE.BoxGeometry(31.2, wy - 0.3, 7.7), new THREE.MeshStandardMaterial({ color: 0x7a6038, transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.2 }));
  vol.position.set(90, 0.3 + (wy - 0.3) / 2, 18.05); vol.renderOrder = 2; g.add(vol);

  // 走道 + 栏杆
  for (const [z, xa, xb] of [[6, 74.4, 103.6], [14, 76.4, 105.6]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, 1.2), M.grating); w.rotation.x = -Math.PI / 2; w.position.set((xa + xb) / 2, h + 0.02, z); g.add(w);
    for (const s of [-0.6, 0.6]) railing(B, [[xa, h, z + s], [xb, h, z + s]], M.railing, { spacing: 2 });
  }
  railing(B, [[x0 + 0.15, h, z0 + 0.15], [x1 - 0.15, h, z0 + 0.15], [x1 - 0.15, h, z1 - 0.15], [x0 + 0.15, h, z1 - 0.15]], M.railing, { closed: true, spacing: 2 });

  // 潜水推流器（厌氧、缺氧区）
  const props = [];
  for (const [x, z] of [[80, 2], [90, 2], [100, 2], [100, 10], [88, 10], [79, 10]]) {
    B.beam([x, 0.3, z - 2.5], [x, h + 1.2, z - 2.5], 0.07, M.galv);
    B.beam([x, h + 1.2, z - 2.5], [x + 0.9, h + 1.5, z - 2.5], 0.05, M.galv);
    B.cyl(0.32, 1.1, M.greyMachine, x, 2.2, z - 2.1, 14, [0, 0, Math.PI / 2]);
    const p = new THREE.Group(); p.position.set(x + (z === 10 ? -0.75 : 0.75), 2.2, z - 2.1);
    for (let k = 0; k < 3; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.35), M.orange); bl.position.y = 0.55; const piv = new THREE.Group(); piv.rotation.x = (k * Math.PI * 2) / 3; piv.add(bl); p.add(piv); }
    g.add(p); props.push(p);
  }
  ctx.anim.push((t) => { for (const p of props) p.rotation.x = t * 4; });

  // 曝气系统：鼓风机 → 空气总管 → 立管 → 盘式微孔曝气器
  pipe(g, [[86, 2.2, 27], [86, 2.2, 24.4], [86, 6.7, 24.4], [86, 6.7, 14.6], [75.5, 6.7, 14.6], [104.6, 6.7, 14.6]], 0.3, PIPE.air, { flanges: true, flangeEvery: 5 });
  for (let x = 76.5; x < 105; x += 3) {
    B.beam([x, 6.7, 14.6], [x, 0.6, 14.6], 0.07, M.galv);
    B.beam([x, 0.55, 14.6], [x, 0.55, 21.6], 0.06, M.galv);
    for (let z = 15.3; z < 21.6; z += 0.9) for (const dx of [-0.5, 0.5]) B.cyl(0.2, 0.06, M.white, x + dx, 0.55, z, 12);
  }
  ctx.bubbles.push({ x0: 75, x1: 105.4, z0: 14.6, z1: 21.6, y0: 0.6, y1: wy - 0.05, count: 1400, size: 0.06, speed: 1.3 });
  // 内回流（硝化液回流）
  pipe(g, [[104.6, 3.5, 19.5], [104.6, 6.4, 19.5], [104.6, 6.4, 9.5], [104.6, 3.5, 9.5]], 0.3, PIPE.sewer, { flangeEvery: 3 });
  B.boxB(0.8, 0.8, 0.8, M.blueMachine, 104.6, 6.3, 18.2);
  // 溶解氧在线仪表
  for (const x of [80, 92, 102]) { B.beam([x, h, 14.6 + 0.7], [x, 0.8, 14.9 + 0.7], 0.03, M.steel); B.boxB(0.35, 0.45, 0.2, M.railing, x, h + 0.3, 15.4); }

  // 鼓风机房（前墙玻璃剖切）
  B.boxB(16, 0.3, 8, M.concreteDark, 86, 0, 29);
  B.boxB(16, 6.5, 0.25, M.plaster, 86, 0, 25.1);
  B.boxB(0.25, 6.5, 8, M.plaster, 78.1, 0, 29);
  B.boxB(0.25, 6.5, 8, M.plaster, 93.9, 0, 29);
  B.boxB(16.4, 0.35, 8.4, M.roofGrey, 86, 6.5, 29);
  B.boxB(15.5, 6.2, 0.06, M.glass, 86, 0.3, 32.97);
  for (const x of [81, 86, 91]) {
    B.boxB(2.6, 1.5, 1.6, M.blueMachine, x, 0.3, 29.4);
    B.cyl(0.5, 1.3, M.greyMachine, x, 1.0, 31.3, 16, [Math.PI / 2, 0, 0]);
    B.boxB(1.2, 0.9, 0.12, M.black, x - 0.6, 1.0, 30.25);
    pipe(g, [[x, 1.2, 28.6], [x, 2.2, 28.6], [x, 2.2, 27]], 0.18, PIPE.air, { flanges: false });
  }
  pipe(g, [[80, 2.2, 27], [92, 2.2, 27]], 0.3, PIPE.air, { flanges: false });
  B.flush(g);

  drawPiece(g, A.toSecondary);
  pipe(g, RAS, 0.3, PIPE.sludge, { flangeEvery: 8 });
  pipe(g, WAS, 0.2, PIPE.sludge, { flangeEvery: 8 });
  g.add(makeLabel('A²/O 生化反应池', 6, 'bio', [90, 10.5, 10]));
  const sub = (txt, pos) => { const l = makeLabel(txt, null, 'bio', pos); l.element.classList.add('sub'); g.add(l); };
  sub('厌氧区', [90, 6.2, 2]); sub('缺氧区', [90, 6.2, 10]); sub('好氧区（曝气）', [90, 6.2, 18]); sub('鼓风机房', [86, 7.5, 29]);
}

// ─────────────── ⑦ 二沉池 ───────────────
function secondary(g, ctx) {
  clarifier(g, ctx, { cx: 124, cz: 10, r: 11, water: 0x6f9282, deep: 0x355a4b, clear: 0x8ec7bd, speed: 0.04 });
  drawPiece(g, A.toTertiary);
  // 回流污泥泵井
  const B = new Batcher();
  B.boxB(3, 1.2, 3, M.concrete, 125.4, -3.6, -6); B.cyl(0.6, 0.08, M.manhole, 125.4, 0.05, -6, 16);
  B.boxB(1.0, 1.0, 1.4, M.blueMachine, 125.4, -3.4, -6);
  B.flush(g);
  g.add(makeLabel('二次沉淀池', 7, 'secondary', [124, 9, 10]));
}

// ─────────────── ⑧ 深度处理：超滤膜车间 ───────────────
function tertiary(g, ctx) {
  const B = new Batcher();
  const x0 = 140, x1 = 156, z0 = 0, z1 = 20, H = 9;
  B.boxB(x1 - x0, 0.3, z1 - z0, M.concreteDark, (x0 + x1) / 2, 0, (z0 + z1) / 2);
  shed(B, { x0, x1, z0, z1, h: H, roof: M.polycarb, cladding: M.aluminium, glassFront: true });
  const tank = rectTank(B, g, { x0: 141, x1: 155, z0: 4, z1: 16, h: 3.3, base: 0.3, water: { y: 2.85, color: 0x7fb5a8, deep: 0x3e7a6c, foam: 0.45, chop: 0.8, opacity: 0.6 } });
  // 膜组器（中空纤维帘式）
  for (const zc of [7, 13]) for (let k = 0; k < 4; k++) {
    const mx = 143.4 + k * 3.1;
    for (const [a, b] of [[[mx - 1.2, 0.6, zc - 0.8], [mx + 1.2, 0.6, zc - 0.8]], [[mx - 1.2, 0.6, zc + 0.8], [mx + 1.2, 0.6, zc + 0.8]], [[mx - 1.2, 2.9, zc - 0.8], [mx + 1.2, 2.9, zc - 0.8]], [[mx - 1.2, 2.9, zc + 0.8], [mx + 1.2, 2.9, zc + 0.8]]]) B.beam(a, b, 0.05, M.steel);
    for (const sx of [-1.2, 1.2]) for (const sz of [-0.8, 0.8]) B.beam([mx + sx, 0.6, zc + sz], [mx + sx, 2.9, zc + sz], 0.05, M.steel);
    for (let c = -1.05; c <= 1.05; c += 0.15) B.boxB(0.05, 2.0, 1.4, M.membrane, mx + c, 0.75, zc);
    B.beam([mx, 2.95, zc], [mx, 4.2, zc], 0.08, PIPE.reclaim);
  }
  ctx.bubbles.push({ x0: 142, x1: 154, z0: 5.5, z1: 14.5, y0: 0.7, y1: 2.8, count: 380, size: 0.05, speed: 1.1 });
  pipe(g, [[142.2, 4.2, 7], [154.4, 4.2, 7], [154.4, 4.2, 13], [142.2, 4.2, 13]], 0.12, PIPE.reclaim, { flanges: false });
  // 产水泵、反洗/CIP 罐
  for (let k = 0; k < 4; k++) { B.boxB(1.0, 0.8, 0.8, M.blueMachine, 143 + k * 2.4, 0.3, 1.6); B.cyl(0.25, 0.6, M.blueMachine, 143 + k * 2.4 + 0.65, 0.7, 1.6, 12, [0, 0, Math.PI / 2]); }
  for (const x of [143, 153]) { B.cyl(1.0, 3.2, M.white, x, 1.9, 18.2, 22); B.cyl(1.0, 0.1, M.steel, x, 3.55, 18.2, 22); }
  B.bar([x0, H - 1.2, 3], [x1, H - 1.2, 3], 0.5, 0.3, M.railing);
  B.bar([x0, H - 1.2, 17], [x1, H - 1.2, 17], 0.5, 0.3, M.railing);
  B.bar([148, H - 0.9, 3], [148, H - 0.9, 17], 0.4, 0.5, M.railing);
  B.boxB(0.8, 0.6, 0.8, M.orange, 148, H - 1.5, 10);
  B.flush(g);
  drawPiece(g, A.permeate);
  g.add(makeLabel('深度处理：超滤膜车间', 8, 'tertiary', [148, 12.5, 10]));
}

// ─────────────── ⑨ 紫外消毒渠 ───────────────
function uv(g, ctx) {
  const B = new Batcher();
  rectTank(B, g, { x0: 157, x1: 172, z0: 8, z1: 12, h: 3, glass: true, rail: false, water: { y: 2.25, color: 0x6fd0e0, deep: 0x2a8aa6, opacity: 0.55, chop: 0.6, flow: [1.5, 0], volOpacity: 0.22 } });
  railing(B, [[157.1, 3, 8.1], [171.9, 3, 8.1]], M.railing);
  for (const bx of [162.5, 166.8]) {
    B.boxB(2.9, 0.3, 4.0, M.steel, bx, 2.85, 10);
    B.boxB(2.9, 0.9, 0.6, M.greyMachine, bx, 3.15, 7.5);
    for (let z = 8.65; z <= 11.4; z += 0.55) {
      B.boxB(0.08, 2.6, 0.08, M.steel, bx - 1.25, 0.4, z);
      for (const y of [0.7, 1.15, 1.6, 2.05]) B.cyl(0.05, 2.4, M.uvLamp, bx, y, z, 8, [0, 0, Math.PI / 2]);
    }
  }
  B.boxB(1.6, 2.0, 0.7, M.greyMachine, 164.6, 0, 14.2);
  for (const x of [164.2, 165]) B.boxB(0.12, 0.12, 0.05, M.ledGreen, x, 1.6, 14.56);
  B.flush(g);
  const light = new THREE.PointLight(0xa070ff, 6, 9, 2); light.position.set(164.6, 1.5, 11.6); g.add(light);
  drawPiece(g, A.toWetland);
  g.add(makeLabel('紫外线消毒', 9, 'uv', [164.6, 6, 10]));
}

// ─────────────── ⑩ 人工湿地 ───────────────
function wetland(g, ctx) {
  const B = new Batcher();
  const x0 = 140, x1 = 180, z0 = 30, z1 = 62;
  const berm = (x, z, w, d) => B.boxB(w, 0.8, d, M.bermSoil, x, 0, z);
  berm((x0 + x1) / 2, z0 + 0.6, x1 - x0, 1.2); berm((x0 + x1) / 2, z1 - 0.6, x1 - x0, 1.2);
  berm(x0 + 0.6, (z0 + z1) / 2, 1.2, z1 - z0); berm(x1 - 0.6, (z0 + z1) / 2, 1.2, z1 - z0);
  B.boxB(x1 - x0 - 2.4, 0.1, z1 - z0 - 2.4, M.gravel, (x0 + x1) / 2, 0.02, (z0 + z1) / 2);
  waterPlane(x1 - x0 - 2.4, z1 - z0 - 2.4, waterMat(0x5aa8a0, { deep: 0x2d6a62, opacity: 0.85, chop: 0.4, flow: [0, 0.3] }), (x0 + x1) / 2, 0.42, (z0 + z1) / 2, g);
  // 布水槽、出水堰
  B.boxB(36, 0.5, 0.6, M.concrete, 160, 0.1, 31.6);
  B.boxB(3, 0.9, 1.6, M.concrete, 178.2, 0, 60.4);
  // 木栈道
  B.boxB(1.8, 0.12, z1 - z0 + 2, M.wood, 151, 0.95, (z0 + z1) / 2);
  for (let z = z0 - 0.5; z <= z1 + 0.5; z += 3) for (const s of [-0.8, 0.8]) B.beam([151 + s, 0, z], [151 + s, 0.95, z], 0.08, M.woodDark);
  for (const s of [-0.9, 0.9]) railing(B, [[151 + s, 1.07, z0 - 0.8], [151 + s, 1.07, z1 + 0.8]], M.wood, { spacing: 2, r: 0.04, h: 0.9 });
  B.boxB(2, 1.2, 0.1, M.greenMachine, 153.5, 1.0, z0 - 1.6);
  // 出水排河口
  B.boxB(1.2, 2.2, 4, M.concrete, 197.4, -2.0, 60.5);
  for (let k = 0; k < 4; k++) B.boxB(1.2, 0.3, 3.4, M.rock, 198.4 + k * 0.9, -1.5 - k * 0.6, 60.5);
  B.flush(g);

  // 芦苇 / 香蒲
  const r = rng(31);
  const N = 3200;
  const reed = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 1, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  let n = 0, guard = 0;
  while (n < N && guard++ < 60000) {
    const cx = x0 + 2 + r() * (x1 - x0 - 4), cz = z0 + 3 + r() * (z1 - z0 - 6);
    if (Math.abs(cx - 160) < 2.5 + (cz - 30) * 0.15 || Math.abs(cx - 151) < 1.5) continue; // 中央水道 & 栈道
    const k = 6 + Math.floor(r() * 18);
    for (let i = 0; i < k && n < N; i++) {
      const x = cx + (r() - 0.5) * 2.4, z = cz + (r() - 0.5) * 2.4;
      if (x < x0 + 1.6 || x > x1 - 1.6 || z < z0 + 1.6 || z > z1 - 1.6) continue;
      const h = 1.6 + r() * 1.6;
      e.set((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3); q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, 0.1 + h / 2, z), q, new THREE.Vector3(1, h, 1));
      reed.setMatrixAt(n, m);
      c.setHSL(0.18 + r() * 0.1, 0.45, 0.32 + r() * 0.18); reed.setColorAt(n++, c);
    }
  }
  reed.count = n; reed.castShadow = true; g.add(reed);
  drawPiece(g, A.outfall);
  g.add(makeLabel('人工湿地生态净化', 10, 'wetland', [160, 4.5, 46]));
}

function admin(scene) {
  const g = new THREE.Group(); scene.add(g);
  const B = new Batcher();
  B.boxB(18, 10.5, 10, M.white, 24, 0, 36);
  for (let y = 1.2; y < 10; y += 3.3) B.boxB(18.1, 1.8, 10.1, M.glassBuilding, 24, y, 36);
  B.boxB(18.6, 0.4, 10.6, M.roofGrey, 24, 10.5, 36);
  B.boxB(10, 0.6, 0.1, M.blueMachine, 24, 9.4, 41.08);
  B.cyl(0.08, 12, M.steel, 36, 6, 42, 8);
  B.boxB(16, 0.06, 6, M.asphalt, 24, 0, 45);
  B.flush(g);
  const l = makeLabel('城市污水处理厂', null, 'headworks', [24, 13, 36]); l.element.classList.add('site'); g.add(l);
}
