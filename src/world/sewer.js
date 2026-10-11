import * as THREE from 'three';
import { TRUNK, yT, STREETS, collX, supX, collectorY, SUPPLY } from '../core/layout.js';
import { M, PIPE } from '../core/mats.js';
import { Batcher, pipe, mesh, makeLabel, railing } from '../core/geo.js';
import { waterMat, waterVolMat, waterPlane } from '../core/water.js';
import { TRUNK_PTS, COLLECTORS, BRANCHES, A, B as BR, XC, XS, P } from '../flow/paths.js';

const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
const shaftMat = M.concreteDark.clone(); shaftMat.side = THREE.DoubleSide;

/** 检查井：井筒 + 井室 + 爬梯 + 井盖 */
function manhole(B, x, z, pipeY, pipeR, cover = M.manhole) {
  const top = 0.08, bot = pipeY - pipeR - 0.3;
  const shaftBot = pipeY + pipeR + 0.4;
  B.add(shaftGeo, shaftMat, [x, (top + shaftBot) / 2, z], [0, 0, 0], [0.65, top - shaftBot, 0.65]);
  B.boxB(2.4, shaftBot - bot, 2.4, M.concreteDark, x, bot, z);
  for (let y = shaftBot + 0.3; y < top - 0.2; y += 0.35) {
    B.bar([x - 0.52, y, z - 0.18], [x - 0.52, y, z + 0.18], 0.03, 0.03, M.steel);
  }
  B.cyl(0.68, 0.06, cover, x, top + 0.03, z, 20);
}

export function buildSewer(scene, ctx) {
  const root = new THREE.Group(); root.name = 'sewer'; root.userData.stage = 'sewer'; scene.add(root);
  const B = new Batcher();

  // 污水干管 DN1800
  pipe(root, [...TRUNK_PTS.slice(0, -1), P(TRUNK.x1 + 0.6, yT(TRUNK.x1), TRUNK.z)], TRUNK.r, PIPE.sewer, { flangeEvery: 10 });
  // 支管 DN900
  for (const c of COLLECTORS) pipe(root, c.pts, 0.45, PIPE.sewer, { flangeEvery: 8 });
  // 检查井
  for (let x = -185; x < -36; x += 22) manhole(B, x, TRUNK.z, yT(x), TRUNK.r);
  for (const xc of XC) {
    manhole(B, xc, TRUNK.z + 0.01, yT(xc), TRUNK.r);
    for (const z of [46, 31, 14, -16, -31, -44]) manhole(B, xc, z, collectorY(xc, z), 0.45);
  }
  B.flush(root, { cast: false });
  ctx.pickables.push(root);
  root.add(makeLabel('市政排水管网（重力流）', 2, 'sewer', [-84, 3, -3]));

  buildSupplyNet(scene, ctx);
  buildPumpStation(scene, ctx);
  return root;
}

function buildSupplyNet(scene, ctx) {
  const root = new THREE.Group(); root.name = 'supplyNet'; root.userData.stage = 'supply'; scene.add(root);
  const B = new Batcher();
  pipe(root, BR.main.pts, 0.4, PIPE.supply, { flangeEvery: 9 });
  for (const b of BRANCHES) pipe(root, b.pts, 0.3, PIPE.supply, { flangeEvery: 9 });
  // 阀门井 + 消火栓
  const valve = (x, z) => {
    B.boxB(1.6, 1.4, 1.6, M.concreteDark, x, SUPPLY.y - 0.9, z);
    B.cyl(0.55, 0.06, M.valveCover, x, 0.11, z, 18);
    B.add(new THREE.TorusGeometry(0.25, 0.04, 8, 16), M.blueMachine, [x, SUPPLY.y + 0.75, z], [Math.PI / 2, 0, 0]);
    B.beam([x, SUPPLY.y + 0.3, z], [x, SUPPLY.y + 0.75, z], 0.04, M.steel);
  };
  for (const xs of XS) valve(xs, SUPPLY.z + 0.01);
  const hydrant = (x, z, fromX) => {
    pipe(root, [[fromX, SUPPLY.y, z], [x, SUPPLY.y, z], [x, 0.2, z]], 0.1, PIPE.supply, { flanges: false });
    B.cyl(0.2, 0.9, M.red, x, 0.65, z, 14);
    B.cyl(0.24, 0.12, M.red, x, 1.1, z, 14);
    B.sphere(0.2, M.red, x, 1.18, z);
    for (const s of [-1, 1]) B.cyl(0.09, 0.22, M.red, x + s * 0.24, 0.85, z, 8, [0, 0, Math.PI / 2]);
  };
  for (const xs of XS) for (const z of [20, 42, -20, -38]) hydrant(xs + 3.6, z, xs);
  B.flush(root);
  ctx.pickables.push(root);
}

function buildPumpStation(scene, ctx) {
  const g = new THREE.Group(); g.name = 'pump'; g.userData.stage = 'pump'; scene.add(g);
  const B = new Batcher();
  const X0 = -31, X1 = -21, Z0 = -7, Z1 = 3, YB = -11, t = 0.4;
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  // 集水井（前墙为玻璃剖切）
  B.boxB(X1 - X0, 0.4, Z1 - Z0, M.concreteDark, cx, YB - 0.4, cz);
  B.boxB(t, -YB + 0.6, Z1 - Z0, M.concrete, X0 + t / 2, YB, cz);
  B.boxB(t, -YB + 0.6, Z1 - Z0, M.concrete, X1 - t / 2, YB, cz);
  B.boxB(X1 - X0, -YB + 0.6, t, M.concrete, cx, YB, Z0 + t / 2);
  B.boxB(X1 - X0, -YB + 0.6, 0.06, M.glass, cx, YB, Z1 - 0.03);
  for (const x of [X0 + t / 2, X1 - t / 2]) B.boxB(t + 0.02, -YB + 0.6, 0.05, M.concreteCut, x, YB, Z1);
  // 水体
  const wl = -8.4;
  B.boxB(X1 - X0 - 2 * t, wl - YB, Z1 - Z0 - t - 0.06, waterVolMat(0x5c4426, 0.5), cx, YB, cz - 0.03 + t / 2 - 0.03);
  waterPlane(X1 - X0 - 2 * t, Z1 - Z0 - t - 0.06, waterMat(0x6b5232, { deep: 0x3e2c16, opacity: 0.88, chop: 0.8, foam: 0.25 }), cx, wl, cz + t / 2 - 0.03, g);
  // 粗格栅
  for (let z = Z0 + 0.6; z < Z1 - 0.3; z += 0.25) B.bar([-28.4, YB + 0.2, z], [-27.8, -5.6, z], 0.05, 0.05, M.steelDark);
  B.bar([-28.4, -5.6, Z0 + 0.4], [-27.8, -5.6, Z1 - 0.2], 0.12, 0.12, M.steelDark);
  // 潜污泵 ×3
  for (const z of [-5, -2, 1]) {
    B.cyl(0.55, 0.5, M.blueMachine, -25.5, YB + 0.35, z, 20);
    B.cyl(0.42, 1.25, M.blueMachine, -25.5, YB + 1.2, z, 18);
    B.cyl(0.3, 0.14, M.steelDark, -25.5, YB + 1.88, z, 12);
    for (let k = 0; k < 6; k++) B.bar([-25.5, YB + 0.75 + k * 0.18, z - 0.43], [-25.5, YB + 0.75 + k * 0.18, z + 0.43], 0.05, 0.02, M.steelDark);
    for (const s of [-0.22, 0.22]) B.beam([-26.15, YB, z + s], [-26.15, 0.3, z + s], 0.035, M.steel);
    B.beam([-25.5, YB + 1.95, z], [-25.5, 3.4, z], 0.015, M.steelDark, 4);
    // 出水立管 + 止回阀 + 闸阀
    const rz = [P(-25.0, -10.4, z), P(-24.2, -10.4, z), P(-24.2, -1.8, z)];
    pipe(g, rz, 0.25, PIPE.sewer, { flangeEvery: 2.5 });
    B.boxB(0.75, 0.6, 0.6, M.greyMachine, -24.2, -4.4, z);
    B.boxB(0.6, 0.7, 0.6, M.greyMachine, -24.2, -3.4, z);
    B.beam([-24.2, -2.7, z], [-23.2, -2.7, z], 0.04, M.steel);
    B.add(new THREE.TorusGeometry(0.28, 0.04, 8, 18), M.red, [-23.2, -2.7, z], [0, Math.PI / 2, 0]);
  }
  pipe(g, [[-24.2, -1.8, -5.3], [-24.2, -1.8, 1.3]], 0.42, PIPE.sewer, { flangeEvery: 3 });
  // 液位计
  B.boxB(0.3, 0.3, 0.3, M.white, -22.2, 0.6, -5.5); B.cyl(0.12, 0.2, M.white, -22.2, 0.5, -5.5, 10);
  // 格栅盖板 + 起重架
  const grate = mesh(new THREE.PlaneGeometry(X1 - X0 - 0.8, Z1 - Z0 - 0.8), M.grating, cx, 0.6, cz, g); grate.rotation.x = -Math.PI / 2;
  railing(B, [[X0, 0.6, Z0], [X1, 0.6, Z0], [X1, 0.6, Z1], [X0, 0.6, Z1]], M.railing, { closed: true });
  for (const z of [Z0 - 0.6, Z1 + 0.6]) {
    B.beam([-25.5 - 1.6, 0, z], [-25.5, 5.6, z], 0.12, M.railing);
    B.beam([-25.5 + 1.6, 0, z], [-25.5, 5.6, z], 0.12, M.railing);
  }
  B.bar([-25.5, 5.6, Z0 - 0.6], [-25.5, 5.6, Z1 + 0.6], 0.25, 0.35, M.railing);
  B.boxB(0.7, 0.6, 0.8, M.orange, -25.5, 4.8, -2);
  // 控制楼
  B.boxB(10, 5, 7, M.plaster, cx, 0, 11);
  B.boxB(10.4, 0.3, 7.4, M.roofGrey, cx, 5, 11);
  B.boxB(1.4, 2.3, 0.1, M.steelDark, -23, 0, 14.52);
  for (const x of [-29, -26.5]) { B.boxB(1.6, 1.2, 0.1, M.glassFrame, x, 2.2, 14.52); B.boxB(1.4, 1.0, 0.12, M.glassBuilding, x, 2.3, 14.52); }
  B.boxB(1.4, 0.9, 0.9, M.white, -28, 5.3, 10);
  B.boxB(6, 0.7, 0.12, M.blueMachine, cx, 3.6, 14.55);
  // 除臭装置（生物滤池）
  B.boxB(5, 2.2, 3, M.greenMachine, -16.5, 0, 0);
  B.cyl(0.35, 5, M.greyMachine, -14.5, 2.5, 1.2, 12);
  pipe(g, [[-21, 0.4, -1], [-19, 1.6, -1]], 0.25, PIPE.air, { flanges: false });
  B.flush(g);

  pipe(g, A.forceMain.pts, A.forceMain.pipe.r, PIPE.sewer, { flangeEvery: 8 });
  g.add(makeLabel('污水提升泵站', 3, 'pump', [-26, 9, -2]));
  ctx.pickables.push(g);
}
