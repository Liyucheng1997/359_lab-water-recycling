import * as THREE from 'three';
import { M, PIPE } from '../core/mats.js';
import { Batcher, pipe, mesh, makeLabel, railing } from '../core/geo.js';
import { waterMat, waterPlane, waterVolMat } from '../core/water.js';
import { riverX, TOWER } from '../core/layout.js';
import { B as BR } from '../flow/paths.js';
import { rectTank, shed } from './common.js';

const stageGroup = (scene, ctx, id) => {
  const g = new THREE.Group(); g.name = id; g.userData.stage = id; scene.add(g); ctx.pickables.push(g); return g;
};
const drawPiece = (g, piece, o = {}) => pipe(g, piece.pts, piece.pipe.r, PIPE[piece.pipe.kind], { supports: piece.pipe.supports, flangeEvery: 6, ...o });
const WY = 4.47;

export function buildDWTP(scene, ctx) {
  intake(stageGroup(scene, ctx, 'river'), ctx);
  coag(stageGroup(scene, ctx, 'coag'), ctx);
  sedi(stageGroup(scene, ctx, 'sedi'), ctx);
  filter(stageGroup(scene, ctx, 'filter'), ctx);
  o3bac(stageGroup(scene, ctx, 'o3bac'), ctx);
  reservoir(stageGroup(scene, ctx, 'disinfect'), ctx);
  supply(stageGroup(scene, ctx, 'supply'), ctx);
  const l = makeLabel('自来水厂', null, 'coag', [92, 16, -100]); l.element.classList.add('site'); scene.add(l);
}

// ─────────────── ⑫ 取水口 + 一级泵房 ───────────────
function intake(g, ctx) {
  const B = new Batcher();
  // 取水头部（岸边式）
  B.boxB(4, 5.6, 0.5, M.concrete, 186.5, -4, -80.25);
  B.boxB(4, 5.6, 0.5, M.concrete, 186.5, -4, -75.75);
  B.boxB(0.5, 5.6, 5, M.concrete, 184.75, -4, -78);
  for (let z = -79.8; z <= -76.2; z += 0.2) B.bar([188.4, -3.9, z], [188.4, 1.5, z], 0.05, 0.06, M.steelDark);
  B.boxB(4.4, 0.3, 5.4, M.concreteDark, 186.5, 1.5, -78);
  for (const s of [-2, 2]) B.boxB(0.3, 3, 0.3, M.railing, 186.5, 1.8, -78 + s);
  B.bar([186.5, 4.8, -80.2], [186.5, 4.8, -75.8], 0.3, 0.4, M.railing);
  B.bar([179, 1.5, -78], [184.6, 1.5, -78], 1.4, 0.2, M.galv);
  railing(B, [[179, 1.6, -78.7], [184.6, 1.6, -78.7]], M.railing); railing(B, [[179, 1.6, -77.3], [184.6, 1.6, -77.3]], M.railing);
  // 一级泵房（吸水井 + 立式长轴泵）
  const x0 = 168, x1 = 178, z0 = -84, z1 = -72;
  B.boxB(x1 - x0, 0.3, z1 - z0, M.concreteDark, 173, -6.3, -78);
  B.boxB(0.4, 6.3, z1 - z0, M.concrete, x0 + 0.2, -6, -78);
  B.boxB(0.4, 6.3, z1 - z0, M.concrete, x1 - 0.2, -6, -78);
  B.boxB(x1 - x0, 6.3, 0.4, M.concrete, 173, -6, z0 + 0.2);
  B.boxB(x1 - x0, 6.3, 0.06, M.glass, 173, -6, z1 - 0.03);
  B.boxB(9.2, -3.4 + 6, 11.5, waterVolMat(0x4f8fa0, 0.45), 173, -6, -78.2);
  waterPlane(9.2, 11.5, waterMat(0x5aa0b0, { deep: 0x245a6a, chop: 0.6, opacity: 0.8 }), 173, -3.4, -78.2, g);
  const gr = mesh(new THREE.PlaneGeometry(9.2, 11.5), M.grating, 173, 0.3, -78.2, g); gr.rotation.x = -Math.PI / 2;
  shed(B, { x0, x1, z0, z1, h: 7, roof: M.roofGrey, cladding: M.plaster, glassFront: true });
  for (const z of [-80, -76]) {
    B.cyl(0.6, 1.8, M.blueMachine, 172, 1.2, z, 18);
    B.cyl(0.4, 0.4, M.greyMachine, 172, 2.3, z, 14);
    B.cyl(0.32, 5.5, M.steel, 172, -2.6, z, 14);
    B.cyl(0.45, 0.8, M.steel, 172, -5.4, z, 14);
  }
  B.bar([x0, 6.2, -78], [x1, 6.2, -78], 0.45, 0.3, M.railing);
  B.flush(g);
  drawPiece(g, BR.rawMain);
  drawPiece(g, BR.lift);
  g.add(makeLabel('水源取水口 · 一级泵房', 12, 'river', [180, 9.5, -78]));
  const rl = makeLabel('河流自净：稀释 · 沉降 · 生物降解', null, 'river', [riverX(-5), 2, -5]); rl.element.classList.add('sub'); g.add(rl);
  // 河流本体也属于本阶段
}

// ─────────────── ⑬ 混凝 + 絮凝 ───────────────
function coag(g, ctx) {
  const B = new Batcher();
  rectTank(B, g, { x0: 156, x1: 162, z0: -81, z1: -75, h: 5, rail: true, water: { y: WY, color: 0x86a39a, deep: 0x4c6a62, foam: 0.3, chop: 1.6 } });
  B.bar([155.6, 5.2, -78], [162.4, 5.2, -78], 0.4, 0.5, M.galv);
  B.cyl(0.45, 1.2, M.blueMachine, 159, 6.0, -78, 16);
  B.cyl(0.07, 4.4, M.steel, 159, 3.2, -78, 8);
  const imp = new THREE.Group(); imp.position.set(159, 1.2, -78); g.add(imp);
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.06), M.steel); b.rotation.y = (k * Math.PI) / 4; imp.add(b); }
  // 连接槽
  B.boxB(2.2, 4.8, 0.3, M.concrete, 155, 0, -79.6); B.boxB(2.2, 4.8, 0.3, M.concrete, 155, 0, -76.4); B.boxB(2.2, 0.3, 3.2, M.concreteDark, 155, 0, -78);
  waterPlane(2.2, 2.9, waterMat(0x86a39a, { chop: 1 }), 155, WY, -78, g);
  // 机械絮凝池（三级，前墙剖切）
  rectTank(B, g, { x0: 134, x1: 154, z0: -88, z1: -68, h: 5, glass: true, water: { y: WY, color: 0x8ea18c, deep: 0x56685a, foam: 0.12, chop: 0.6, volOpacity: 0.16 } });
  for (const x of [147.3, 140.6]) B.boxB(0.25, 4.4, 19.2, M.concrete, x, 0.3, -78);
  const paddles = [];
  for (const [x, sp] of [[150.7, 0.5], [144, 0.33], [137.3, 0.2]]) {
    B.cyl(0.12, 19.6, M.steel, x, 2.4, -78, 10, [Math.PI / 2, 0, 0]);
    B.boxB(1.2, 1.2, 1.4, M.blueMachine, x, 5, -88.8);
    const p = new THREE.Group(); p.position.set(x, 2.4, -78); g.add(p);
    for (const z of [-6, 0, 6]) for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2; arm.position.z = z; p.add(arm);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), M.galv); bar.position.y = 0.9; arm.add(bar);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 4.6), M.wood); blade.position.y = 1.65; arm.add(blade);
    }
    paddles.push([p, sp]);
  }
  ctx.anim.push((t) => { imp.rotation.y = t * 6; for (const [p, sp] of paddles) p.rotation.z = -t * sp; });
  // 矾花（絮体）
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xbfa77a, roughness: 1 }), 420);
  const m = new THREE.Matrix4(); const flocs = [];
  for (let i = 0; i < 420; i++) flocs.push({ x: 134.6 + Math.random() * 18.8, y: 0.6 + Math.random() * 3.7, z: -87.4 + Math.random() * 19, s: 0.03 + ((154 - 134.6) - 0) * 0 + Math.random() * 0.05, p: Math.random() * 6 });
  ctx.anim.push((t, dt) => {
    flocs.forEach((f, i) => {
      f.x -= dt * 0.25; if (f.x < 134.6) f.x = 153.4;
      const grow = 0.03 + (153.4 - f.x) / 18.8 * 0.11;
      m.makeScale(grow, grow, grow).setPosition(f.x, f.y + Math.sin(t + f.p) * 0.15, f.z);
      fl.setMatrixAt(i, m);
    });
    fl.instanceMatrix.needsUpdate = true;
  });
  fl.frustumCulled = false; g.add(fl);
  // PAC 投加间
  B.boxB(10, 0.6, 5, M.concrete, 158, 0, -52);
  for (const x of [155, 158, 161]) { B.cyl(1.1, 3.6, M.white, x, 2.4, -52, 20); B.cyl(0.2, 0.6, M.blueMachine, x, 4.5, -52, 10); }
  pipe(g, [[158, 0.6, -54.4], [158, -0.8, -56], [158, -0.8, -74], [158, 5.4, -74], [158, 5.4, -77], [158, 4.7, -77]], 0.07, M.white, { flanges: false });
  B.flush(g);
  g.add(makeLabel('混凝与絮凝', 13, 'coag', [148, 9, -78]));
  const s = makeLabel('PAC 投加', null, 'coag', [158, 6.5, -52]); s.element.classList.add('sub'); g.add(s);
}

// ─────────────── ⑭ 斜管沉淀池 ───────────────
function sedi(g, ctx) {
  const B = new Batcher();
  rectTank(B, g, { x0: 106, x1: 133.6, z0: -88, z1: -68, h: 5, glass: true, water: { y: WY, color: 0x7fb4b8, deep: 0x3d7880, chop: 0.4, volOpacity: 0.28 } });
  // 斜管/斜板（60°）
  const plate = new THREE.BoxGeometry(0.03, 1.8, 19.0);
  for (let x = 110; x <= 130; x += 0.45) B.add(plate, M.white, [x, 2.8, -78], [0, 0, Math.PI / 6]);
  for (const x of [110, 130]) B.bar([x, 2.0, -87.5], [x, 2.0, -68.5], 0.15, 0.15, M.galv);
  // 集水槽
  for (let x = 111; x <= 129; x += 3) {
    B.boxB(0.5, 0.06, 19, M.steel, x, 3.9, -78);
    for (const s of [-0.25, 0.25]) B.boxB(0.04, 0.6, 19, M.steel, x + s, 3.9, -78);
  }
  // 排泥斗 + 刮泥
  for (let x = 108; x < 132; x += 4) B.add(new THREE.ConeGeometry(1.6, 1.0, 4), M.concreteDark, [x, 0.8, -78], [Math.PI, Math.PI / 4, 0]);
  B.boxB(1.2, 0.06, 19.2, M.sludge, 107, 0.3, -78);
  B.boxB(1.0, 5.0, 3.0, M.concrete, 105, 0, -78);
  B.flush(g);
  g.add(makeLabel('斜管沉淀池', 14, 'sedi', [120, 8.5, -78]));
}

// ─────────────── ⑮ V 型滤池 ───────────────
function filter(g, ctx) {
  const B = new Batcher();
  rectTank(B, g, { x0: 76, x1: 104, z0: -90, z1: -66, h: 5, glass: true, water: { y: WY, color: 0x7cc0d0, deep: 0x3a7f92, chop: 0.4, volOpacity: 0.22 } });
  B.boxB(0.6, 5, 23.5, M.concrete, 90, 0, -78.2);
  for (const [a, b] of [[76.4, 89.7], [90.3, 103.6]]) {
    const cx = (a + b) / 2, w = b - a;
    B.boxB(w, 0.2, 23.5, M.concreteDark, cx, 0.7, -78.2);         // 滤板
    for (let x = a + 0.4; x < b; x += 0.6) for (let z = -89.4; z < -66.6; z += 0.8) B.cyl(0.05, 0.12, M.black, x, 0.95, z, 6);
    B.boxB(w, 0.4, 23.5, M.gravel, cx, 0.9, -78.2);                // 承托层
    B.boxB(w, 1.2, 23.5, M.sand, cx, 1.3, -78.2);                  // 石英砂滤层
    // V 形进水槽
    for (const z of [-89.0, -67.5]) {
      const sh = new THREE.Shape(); sh.moveTo(-0.6, 0); sh.lineTo(0.6, 0); sh.lineTo(0, -1.0); sh.lineTo(-0.6, 0);
      const eg = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); eg.rotateY(Math.PI / 2);
      B.add(eg, M.concrete, [a, WY + 0.25, z]);
    }
  }
  // 管廊：反冲洗管 + 气水阀门
  pipe(g, [[77, 0.5, -91.4], [103, 0.5, -91.4]], 0.35, PIPE.raw, { flangeEvery: 3 });
  pipe(g, [[77, 1.4, -91.4], [103, 1.4, -91.4]], 0.25, PIPE.air, { flangeEvery: 3 });
  for (const x of [83, 97]) { B.boxB(0.8, 0.8, 0.8, M.blueMachine, x, 0.1, -91.4); B.cyl(0.05, 1.2, M.steel, x, 1.4, -91.4, 6); }
  B.flush(g);
  drawPiece(g, BR.toOzone);
  g.add(makeLabel('V 型砂滤池', 15, 'filter', [90, 8.5, -78]));
  const s = makeLabel('石英砂 1.2m · 气水反冲洗', null, 'filter', [90, 2.2, -65.5]); s.element.classList.add('sub'); g.add(s);
}

// ─────────────── ⑯ 臭氧接触池 + 生物活性炭 ───────────────
function o3bac(g, ctx) {
  const B = new Batcher();
  rectTank(B, g, { x0: 62, x1: 72, z0: -90, z1: -66, h: 5.4, glass: true, water: { y: WY, color: 0x86c9d4, deep: 0x3d8a99, chop: 0.8, foam: 0.25, volOpacity: 0.22 } });
  B.boxB(10, 0.4, 12, M.concrete, 67, 5.4, -84);
  for (const [z, top] of [[-82, true], [-74, false]]) B.boxB(9.2, top ? 4.4 : 3.6, 0.25, M.concrete, 67, top ? 1.4 : 0.3, z);
  ctx.bubbles.push({ x0: 62.6, x1: 71.4, z0: -89.4, z1: -82.4, y0: 0.5, y1: WY - 0.05, count: 300, size: 0.045, speed: 1.0 });
  for (let x = 63; x < 71.5; x += 1.2) for (let z = -89; z < -83; z += 1.2) B.cyl(0.18, 0.05, M.white, x, 0.4, z, 10);
  B.boxB(2.4, 1.4, 1.6, M.white, 66, 5.8, -86); B.cyl(0.2, 2, M.steel, 67.6, 6.8, -86, 10);
  rectTank(B, g, { x0: 48, x1: 61.6, z0: -90, z1: -66, h: 5, glass: true, water: { y: WY, color: 0x7ccada, deep: 0x357f92, chop: 0.4, volOpacity: 0.18 } });
  B.boxB(12.8, 0.2, 23.5, M.concreteDark, 54.8, 0.8, -78.2);
  B.boxB(12.8, 0.4, 23.5, M.gravel, 54.8, 1.0, -78.2);
  B.boxB(12.8, 1.6, 23.5, M.carbon, 54.8, 1.4, -78.2);
  // 臭氧发生器间 + 液氧罐
  B.boxB(16, 6, 8, M.plaster, 60, 0, -100); B.boxB(16.4, 0.3, 8.4, M.roofGrey, 60, 6, -100);
  B.cyl(1.4, 9.5, M.white, 74, 4.75, -100, 24); B.add(new THREE.SphereGeometry(1.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.white, [74, 9.5, -100]);
  for (let k = 0; k < 4; k++) B.boxB(0.5, 4, 0.5, M.aluminium, 77 + (k % 2) * 0.8, 0, -101 + Math.floor(k / 2) * 1.2);
  pipe(g, [[64, 3, -96], [66, 3, -96], [66, 6.2, -92], [66, 6.2, -86.4], [66, 0.6, -86.4]], 0.12, PIPE.air, { flanges: false });
  B.flush(g);
  g.add(makeLabel('臭氧-生物活性炭', 16, 'o3bac', [61, 9.5, -78]));
  const s = makeLabel('臭氧发生器 · 液氧站', null, 'o3bac', [64, 8.5, -100]); s.element.classList.add('sub'); g.add(s);
  drawPiece(g, BR.toReservoir);
}

// ─────────────── ⑰ 消毒 + 清水池 ───────────────
function reservoir(g, ctx) {
  const B = new Batcher();
  const x0 = 10, x1 = 44, z0 = -92, z1 = -64, yb = -4, top = 2.5;
  B.boxB(x1 - x0, 0.4, z1 - z0, M.concreteDark, 27, yb - 0.4, -78);
  B.boxB(0.4, top - yb, z1 - z0, M.concrete, x0 + 0.2, yb, -78);
  B.boxB(0.4, top - yb, z1 - z0, M.concrete, x1 - 0.2, yb, -78);
  B.boxB(x1 - x0, top - yb, 0.4, M.concrete, 27, yb, z0 + 0.2);
  B.boxB(x1 - x0 - 0.8, top - yb, 0.06, M.glass, 27, yb, z1 - 0.03);
  for (const x of [x0 + 0.2, x1 - 0.2]) B.boxB(0.42, top - yb, 0.05, M.concreteCut, x, yb, z1);
  // 导流墙（廊道式，保证接触时间）
  B.boxB(43.6 - 14, top - yb, 0.3, M.concrete, (14 + 43.6) / 2, yb, -73.3);
  B.boxB(40 - 10.4, top - yb, 0.3, M.concrete, (10.4 + 40) / 2, yb, -82.7);
  B.boxB(33.2, 1.55 - yb, 27.5, waterVolMat(0x4aa8e0, 0.32), 27, yb, -78.1);
  waterPlane(33.2, 27.5, waterMat(0x6cc4f0, { deep: 0x2a7cc0, chop: 0.4, opacity: 0.78, flow: [-0.3, 0] }), 27, 1.55, -78.1, g);
  // 覆土顶板（后段）+ 通气帽
  B.boxB(x1 - x0, 0.4, 9.2, M.concrete, 27, top, z0 + 4.6);
  B.boxB(x1 - x0, 0.3, 9.2, M.grassDark, 27, top + 0.4, z0 + 4.6);
  for (const x of [16, 27, 38]) { B.cyl(0.25, 1.4, M.white, x, top + 1.1, -88, 10); B.cyl(0.55, 0.3, M.white, x, top + 1.9, -88, 14); }
  railing(B, [[x0 + 0.2, top, -82.8], [x1 - 0.2, top, -82.8]], M.railing);
  railing(B, [[x0 + 0.2, top, -64.2], [x1 - 0.2, top, -64.2]], M.railing);
  // 加氯间 + 投加管
  B.boxB(8, 5, 6, M.plaster, 52, 0, -52); B.boxB(8.4, 0.3, 6.4, M.roofGrey, 52, 5, -52);
  for (const x of [50, 52, 54]) B.cyl(0.4, 1.5, M.greenMachine, x, 0.9, -48.6, 12);
  pipe(g, [[52, 0.5, -55.2], [52, -0.8, -57], [46.6, -0.8, -64], [46.6, 0.6, -68.2]], 0.07, M.greenMachine, { flanges: false });
  B.flush(g);
  drawPiece(g, BR.toPumps);
  g.add(makeLabel('消毒与清水池', 17, 'disinfect', [27, 6.5, -78]));
  const s = makeLabel('加氯间（次氯酸钠）', null, 'disinfect', [52, 7, -52]); s.element.classList.add('sub'); g.add(s);
}

// ─────────────── ⑱ 二级泵房 + 水塔 ───────────────
function supply(g, ctx) {
  const B = new Batcher();
  const x0 = -8, x1 = 6, z0 = -86, z1 = -70;
  B.boxB(x1 - x0, 0.3, z1 - z0, M.concreteDark, -1, 0, -78);
  shed(B, { x0, x1, z0, z1, h: 7.5, roof: M.polycarb, cladding: M.plaster, glassFront: true });
  pipe(g, [[4.2, 0.9, -84], [4.2, 0.9, -72]], 0.42, PIPE.supply, { flangeEvery: 2 });
  pipe(g, [[-4.6, 1.6, -84], [-4.6, 1.6, -72]], 0.42, PIPE.supply, { flangeEvery: 2 });
  for (const z of [-82, -78, -74]) {
    B.boxB(2.4, 0.3, 4.2, M.steelDark, 0, 0.3, z - 1.0);
    B.cyl(0.75, 1.0, M.blueMachine, 0, 0.95, z, 24, [Math.PI / 2, 0, 0]);
    B.boxB(1.8, 0.5, 1.2, M.blueMachine, 0, 0.55, z);
    B.cyl(0.18, 0.9, M.orange, 0, 0.95, z - 0.95, 10, [Math.PI / 2, 0, 0]);
    B.cyl(0.6, 1.8, M.greenMachine, 0, 0.95, z - 2.2, 20, [Math.PI / 2, 0, 0]);
    if (z !== -78) {
      pipe(g, [[4.2, 0.9, z], [1.0, 0.9, z]], 0.3, PIPE.supply, { flanges: true, flangeEvery: 1.5 });
      pipe(g, [[-1.0, 0.9, z], [-3.4, 1.6, z], [-4.6, 1.6, z]], 0.3, PIPE.supply, { flanges: true, flangeEvery: 1.5 });
    } else pipe(g, BR.pump.pts, 0.3, PIPE.supply, { flanges: true, flangeEvery: 1.5 });
    B.cyl(0.18, 0.12, M.white, -2.8, 2.4, z, 12, [Math.PI / 2, 0, 0]);
  }
  B.bar([x0, 6.6, -78], [x1, 6.6, -78], 0.5, 0.35, M.railing);
  B.boxB(1, 0.8, 1, M.orange, -1, 5.6, -78);
  // 水塔
  const { x, z } = TOWER;
  B.cyl(TOWER.shaftR, TOWER.tankY0, M.concrete, x, TOWER.tankY0 / 2, z, 40);
  for (let y = 4; y < 24; y += 4) B.boxB(0.6, 1.2, 0.2, M.glassBuilding, x, y, z + TOWER.shaftR - 0.05);
  B.boxB(1.4, 2.3, 0.3, M.steelDark, x, 0, z + TOWER.shaftR);
  const prof = [[0.01, 25.6], [2.5, 25.6], [2.5, 26], [8, 29.5], [8, 35], [8.4, 35], [8.4, 35.4], [0.6, 38.4], [0.01, 38.6]].map(([r, y]) => new THREE.Vector2(r, y));
  mesh(new THREE.LatheGeometry(prof, 64), M.white, x, 0, z, g);
  // 液位观察带
  mesh(new THREE.CylinderGeometry(8.05, 8.05, 3.2, 64, 1, true, -0.6, 1.2), new THREE.MeshStandardMaterial({ color: 0x5bb8ff, transparent: true, opacity: 0.55, roughness: 0.1 }), x, 31.6, z, g);
  const bal = []; for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; bal.push([x + Math.cos(a) * 8.9, 30, z + Math.sin(a) * 8.9]); }
  const deck = mesh(new THREE.RingGeometry(7.6, 9.1, 64), M.grating, x, 30, z, g); deck.rotation.x = -Math.PI / 2;
  railing(B, bal, M.railing, { closed: true, spacing: 2 });
  for (let y = 1; y < 30; y += 0.4) B.bar([x - 0.35, y, z - TOWER.shaftR - 0.4], [x + 0.35, y, z - TOWER.shaftR - 0.4], 0.04, 0.04, M.steel);
  for (const s of [-0.35, 0.35]) B.beam([x + s, 0, z - TOWER.shaftR - 0.4], [x + s, 30, z - TOWER.shaftR - 0.4], 0.04, M.steel);
  B.beam([x, 38.4, z], [x, 42, z], 0.06, M.steel);
  B.sphere(0.2, M.red, x, 42.1, z);
  B.flush(g);
  drawPiece(g, BR.toTower);
  drawPiece(g, BR.downcomer);
  g.add(makeLabel('二级泵站 · 水塔 · 供水管网', 18, 'supply', [x, 44, z]));
  const s = makeLabel('二级泵房', null, 'supply', [-1, 10, -78]); s.element.classList.add('sub'); g.add(s);
}
