import * as THREE from 'three';
import { STREETS, HOUSE, collX, supX, collectorY, SUPPLY } from '../core/layout.js';
import { M, PIPE, pipeVariant } from '../core/mats.js';
import { Batcher, facadeBox, rng, pipe, mesh, boxMesh, makeLabel, railing } from '../core/geo.js';
import { waterMat } from '../core/water.js';
import { cityBlocks } from './terrain.js';
import { addFlow, P, H, STACK } from '../flow/paths.js';

export function buildCity(scene, ctx) {
  const root = new THREE.Group(); root.name = 'city'; scene.add(root);
  const B = new Batcher();
  const under = new THREE.Group(); root.add(under); // 地下入户管
  const r = rng(2024);
  const houseKeep = { x0: HOUSE.x0 - 3, x1: HOUSE.x1 + 4, z0: HOUSE.z0 - 3, z1: HOUSE.z1 + 4 };
  const buildings = [];

  for (const blk of cityBlocks()) {
    const W = blk.x1 - blk.x0, D = blk.z1 - blk.z0;
    const nx = Math.max(1, Math.floor(W / 17)), nz = Math.max(1, Math.floor(D / 15));
    const lw = W / nx, ld = D / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const cx = blk.x0 + lw * (i + 0.5), cz = blk.z0 + ld * (j + 0.5);
      const lx0 = cx - lw / 2, lx1 = cx + lw / 2, lz0 = cz - ld / 2, lz1 = cz + ld / 2;
      if (lx1 > houseKeep.x0 && lx0 < houseKeep.x1 && lz1 > houseKeep.z0 && lz0 < houseKeep.z1) continue;
      const t = r();
      let bw, bd, h, kind;
      if (t < 0.42) { kind = 'tower'; bw = Math.min(lw, ld) - 4; bd = bw * (0.8 + r() * 0.2); h = 3 * (6 + Math.floor(r() * 7)); }
      else if (t < 0.75) { kind = 'slab'; bw = lw - 3; bd = Math.min(ld - 5, 10); h = 3 * (3 + Math.floor(r() * 4)); }
      else { kind = 'house'; bw = Math.min(10, lw - 5); bd = Math.min(8, ld - 6); h = 6; }
      bw = Math.max(6, bw); bd = Math.max(6, bd);
      buildings.push({ kind, x: cx, z: cz, w: bw, d: bd, h, mat: Math.floor(r() * M.facades.length) });
    }
  }

  for (const b of buildings) {
    if (b.kind === 'house') {
      const g = facadeBox(b.w, b.h, b.d);
      const m = mesh(g, [M.facades[b.mat], M.facades[b.mat], M.roofFlat, M.roofFlat, M.facades[b.mat], M.facades[b.mat]], b.x, b.h / 2, b.z, root);
      const roof = new THREE.Shape(); roof.moveTo(-b.d / 2 - 0.5, 0); roof.lineTo(b.d / 2 + 0.5, 0); roof.lineTo(0, 2.6);
      const rg = new THREE.ExtrudeGeometry(roof, { depth: b.w + 0.8, bevelEnabled: false });
      rg.rotateY(Math.PI / 2); rg.translate(-(b.w + 0.8) / 2, 0, 0);
      mesh(rg, M.roofTile, b.x, b.h, b.z, root);
      B.boxB(0.6, 1.6, 0.6, M.brick, b.x + b.w * 0.3, b.h + 0.6, b.z - b.d * 0.15);
    } else {
      const fm = M.facades[b.mat];
      mesh(facadeBox(b.w, b.h, b.d), [fm, fm, M.roofFlat, M.roofFlat, fm, fm], b.x, b.h / 2, b.z, root);
      // 女儿墙、屋顶水箱、电梯机房、空调
      const p = 0.25;
      B.boxB(b.w, 0.9, p, M.concrete, b.x, b.h, b.z - b.d / 2 + p / 2);
      B.boxB(b.w, 0.9, p, M.concrete, b.x, b.h, b.z + b.d / 2 - p / 2);
      B.boxB(p, 0.9, b.d, M.concrete, b.x - b.w / 2 + p / 2, b.h, b.z);
      B.boxB(p, 0.9, b.d, M.concrete, b.x + b.w / 2 - p / 2, b.h, b.z);
      B.boxB(3, 2.6, 3, M.concrete, b.x - b.w * 0.2, b.h, b.z);
      if (b.kind === 'tower') {
        B.cyl(1.1, 2.2, M.steel, b.x + b.w * 0.22, b.h + 1.6, b.z + b.d * 0.15, 16);
        for (const s of [-0.6, 0.6]) B.beam([b.x + b.w * 0.22 + s, b.h, b.z + b.d * 0.15], [b.x + b.w * 0.22 + s, b.h + 0.5, b.z + b.d * 0.15], 0.08, M.steelDark);
      }
      for (let k = 0; k < 3; k++) B.boxB(1, 0.8, 0.7, M.white, b.x + b.w * 0.3 - k * 1.4, b.h, b.z - b.d * 0.3);
      // 入口雨棚
      B.boxB(3.5, 0.2, 1.6, M.steelDark, b.x, 2.8, b.z + (b.z > 0 ? -1 : 1) * (b.d / 2 + 0.8));
    }

    // 地下：出户污水管 + 入户给水管（并注册水流）
    const sx = STREETS.reduce((a, s) => (Math.abs(s - b.x) < Math.abs(a - b.x) ? s : a), STREETS[0]);
    const dir = Math.sign(sx - b.x);
    const fx = b.x + dir * b.w / 2;
    const xc = collX(sx), xs = supX(sx);
    const zl = b.z - 1.2, zs = b.z + 1.2;
    const lat = [P(fx - dir * 1.5, -1.0, zl, { q: 0.02 }), P(fx + dir * 1.5, -1.3, zl), P(xc, collectorY(xc, zl) + 0.12, zl)];
    pipe(under, lat, 0.18, PIPE.sewer, { flanges: false });
    addFlow(lat, { size: 0.12, density: 1.1, spread: 0.08, q: 0.02, speed: 0.8 });
    const svc = [P(xs, SUPPLY.y, zs, { q: 1 }), P(fx + dir * 1.2, -1.0, zs), P(fx - dir * 1.5, -1.0, zs)];
    pipe(under, svc, 0.1, PIPE.supply, { flanges: false });
    addFlow(svc, { size: 0.09, density: 1.2, spread: 0.04, q: 1, speed: 0.8 });
    B.cyl(0.45, 1.0, M.concreteDark, fx + dir * 1.5, -0.5, zl, 12); // 检查井
    B.cyl(0.5, 0.06, M.manhole, fx + dir * 1.5, 0.03, zl, 16);
  }
  B.flush(root);

  buildHouse(root, ctx);
  root.add(makeLabel('居民用水与排放', 1, 'house', [HOUSE.cx, 12, HOUSE.cz]));
  return root;
}

// ───────────────────────── 剖切示范住宅 ─────────────────────────
function buildHouse(root, ctx) {
  const g = new THREE.Group(); g.name = 'house'; g.userData.stage = 'house'; root.add(g);
  const B = new Batcher();
  const HP = { sewer: pipeVariant(PIPE.sewer, 0.8), supply: pipeVariant(PIPE.supply, 0.85), hot: pipeVariant(PIPE.hot, 0.85) };
  const { x0, x1, z0, z1 } = HOUSE;
  const W = x1 - x0, D = z1 - z0;
  const cx = (x0 + x1) / 2;
  const t = 0.25;
  const F1 = 0.3, F2 = 3.3, F3 = 6.3;

  // 地基与楼板
  B.boxB(W + 0.4, 0.3, D + 0.4, M.concreteDark, cx, 0, (z0 + z1) / 2);
  B.boxB(W, 0.2, D, M.concrete, cx, F2 - 0.2, (z0 + z1) / 2);
  B.boxB(W, 0.2, (D / 2) + 0.2, M.concrete, cx, F3 - 0.2, z0 + D / 4 + 0.1);
  // 地面装饰
  B.boxB(6.6, 0.02, D - t, M.tile, -125.45, F1, (z0 + z1) / 2 + t / 2);
  B.boxB(6.6, 0.02, D - t, M.wood, -118.6, F1, (z0 + z1) / 2 + t / 2);
  B.boxB(6.6, 0.02, D - t, M.tile, -125.45, F2, (z0 + z1) / 2 + t / 2);
  B.boxB(6.6, 0.02, D - t, M.wood, -118.6, F2, (z0 + z1) / 2 + t / 2);
  // 外墙（前墙剖开）
  B.boxB(W, F3 - F1, t, M.plasterWarm, cx, F1, z0 + t / 2);
  B.boxB(t, F3 - F1, D, M.plasterWarm, x0 + t / 2, F1, (z0 + z1) / 2);
  B.boxB(t, F3 - F1, D, M.plasterWarm, x1 - t / 2, F1, (z0 + z1) / 2);
  B.boxB(0.2, F3 - F1, D - t, M.plaster, -122, F1, (z0 + z1) / 2 + t / 2);
  // 剖切面（深色截面）
  for (const x of [x0 + t / 2, x1 - t / 2]) B.boxB(t + 0.02, F3 - F1, 0.04, M.concreteCut, x, F1, z1 - 0.02);
  B.boxB(W, 0.22, 0.04, M.concreteCut, cx, F2 - 0.21, z1 - 0.02);
  // 卫生间墙砖
  B.boxB(6.5, 2.1, 0.03, M.tile, -125.45, F2, z0 + t + 0.02);
  B.boxB(0.03, 2.1, D - t, M.tile, x0 + t + 0.02, F2, (z0 + z1) / 2 + t / 2);
  // 窗（背墙与侧墙）
  for (const [wx, wy] of [[-126, 1.4], [-118.5, 1.4], [-126, 4.4], [-118.5, 4.4]]) {
    B.boxB(1.6, 1.3, 0.12, M.glassFrame, wx, wy, z0 - 0.02);
    B.boxB(1.4, 1.1, 0.14, M.glassBuilding, wx, wy + 0.1, z0 - 0.02);
  }
  for (const [wz, wy] of [[22, 1.4], [22, 4.4]]) for (const xx of [x0, x1]) {
    B.boxB(0.12, 1.3, 1.8, M.glassFrame, xx, wy, wz);
    B.boxB(0.14, 1.1, 1.6, M.glassBuilding, xx, wy + 0.1, wz);
  }
  // 屋顶（仅后坡，剖切展示）
  {
    const roofW = W + 1.2, rise = 2.9, run = D / 2 + 0.5;
    const slope = Math.hypot(rise, run);
    const geo = new THREE.BoxGeometry(roofW, 0.22, slope);
    const m = mesh(geo, M.roofTile, cx, F3 + rise / 2 + 0.05, z0 - 0.5 + run / 2, g);
    m.rotation.x = -Math.atan2(rise, run);
    // 山墙（三角）
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(D / 2, 0); sh.lineTo(D / 2, rise - 0.1); sh.lineTo(0, 0);
    for (const xx of [x0, x1 - t]) {
      const eg = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
      eg.rotateY(-Math.PI / 2);
      mesh(eg, M.plasterWarm, xx + t, F3, z0, g);
    }
  }

  // 厨房（一层左）
  B.boxB(4.2, 0.85, 0.7, M.wood, -125.5, F1, z0 + t + 0.35);
  for (let k = 0; k < 5; k++) B.boxB(0.04, 0.6, 0.02, M.woodDark, -127.4 + k * 0.84, F1 + 0.12, z0 + t + 0.71);
  B.boxB(4.3, 0.06, 0.75, M.steelDark, -125.5, F1 + 0.85, z0 + t + 0.37);
  B.boxB(0.75, 0.04, 0.5, M.steel, -126, F1 + 0.86, 17.62); // 水槽
  B.boxB(0.65, 0.02, 0.4, M.black, -126, F1 + 0.79, 17.62);
  B.boxB(0.9, 1.9, 0.75, M.aluminium, -128.1, F1, z0 + t + 0.4); // 冰箱
  B.boxB(2.4, 0.06, 1.2, M.wood, -125.6, F1 + 0.74, 23); // 餐桌
  for (const [dx, dz] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) B.beam([-125.6 + dx, F1, 23 + dz], [-125.6 + dx, F1 + 0.74, 23 + dz], 0.04, M.woodDark);
  for (const dz of [-1, 1]) B.boxB(0.5, 0.45, 0.5, M.woodDark, -125.6, F1, 23 + dz * 0.95);
  // 水龙头
  B.cyl(0.035, 0.38, M.chrome, -126, F1 + 1.08, 17.55, 10);
  pipe(g, [[-126, F1 + 1.27, 17.55], [-126, F1 + 1.3, 17.86], [-126, F1 + 1.23, 17.86]], 0.025, M.chrome, { flanges: false, bend: 0.08, radial: 8 });
  // 洗衣机、热水器、楼梯、沙发（一层右）
  B.boxB(0.65, 0.88, 0.62, M.white, -118, F1, 18.25);
  {
    const ring = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), M.chrome, -118, F1 + 0.5, 18.57, g);
    mesh(new THREE.CircleGeometry(0.19, 24), M.glassBuilding, -118, F1 + 0.5, 18.57, g);
    ring.castShadow = false;
  }
  B.cyl(0.28, 1.1, M.white, -120.5, 1.9, 17.6, 18);
  pipe(g, [[-120.5, 1.35, 17.6], [-120.5, 1.15, 17.6], [-121.9, 1.15, 17.6], [-125.6, 1.15, 17.55], [-125.9, 1.2, 17.55]], 0.03, HP.hot, { flanges: false });
  pipe(g, [[-120.5, 2.45, 17.6], [-120.5, 4.7, 17.6], [-123.1, 4.7, 17.6], [-123.1, 4.45, 17.7]], 0.03, HP.hot, { flanges: false });
  for (let k = 0; k < 14; k++) B.boxB(1.2, 0.21 * (k + 1), 0.3, M.wood, -116.0, F1, 26.4 - k * 0.3);
  B.boxB(2.2, 0.45, 0.9, M.blueMachine, -119, F1, 25.6); B.boxB(2.2, 0.5, 0.2, M.blueMachine, -119, F1 + 0.45, 26.0);

  // 卫生间（二层左）
  {
    const tx = -125.8, tz = 18.25;
    B.cyl(0.17, 0.32, M.ceramic, tx, F2 + 0.16, tz, 16);
    const bowl = mesh(new THREE.SphereGeometry(0.26, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.ceramic, tx, F2 + 0.42, tz, g);
    bowl.rotation.x = Math.PI; bowl.scale.set(1, 0.5, 1.3);
    const seat = mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 24), M.ceramic, tx, F2 + 0.44, tz, g); seat.rotation.x = Math.PI / 2; seat.scale.set(1, 1.3, 1);
    B.boxB(0.5, 0.42, 0.2, M.ceramic, tx, F2 + 0.5, 17.42 + 0.1);
    // 洗手盆
    B.cyl(0.11, 0.78, M.ceramic, -123.3, F2 + 0.39, 17.8, 12);
    const basin = mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.ceramic, -123.3, F2 + 0.9, 17.82, g);
    basin.rotation.x = Math.PI; basin.scale.set(1, 0.45, 0.75);
    B.cyl(0.025, 0.2, M.chrome, -123.3, F2 + 0.98, 17.58, 8);
    B.boxB(0.8, 0.9, 0.03, M.glassBuilding, -123.3, F2 + 1.2, z0 + t + 0.05);
    // 浴缸
    B.boxB(1.6, 0.08, 4.2, M.ceramic, -127.85, F2, 22.8);
    for (const s of [-1, 1]) {
      B.boxB(0.12, 0.58, 4.2, M.ceramic, -127.85 + s * 0.74, F2, 22.8);
      B.boxB(1.6, 0.58, 0.12, M.ceramic, -127.85, F2, 22.8 + s * 2.04);
    }
    const bw = mesh(new THREE.PlaneGeometry(1.3, 3.9), waterMat(0x9fd8f0, { deep: 0x5fb0d6, opacity: 0.75, chop: 0.2 }), -127.85, F2 + 0.5, 22.8, g);
    bw.rotation.x = -Math.PI / 2; bw.renderOrder = 3;
  }
  // 卧室（二层右）
  B.boxB(2.0, 0.5, 2.3, M.wood, -118.5, F2, 21); B.boxB(1.9, 0.2, 2.2, M.white, -118.5, F2 + 0.5, 21);
  B.boxB(2.0, 1.0, 0.12, M.woodDark, -118.5, F2, 19.8);
  B.boxB(1.6, 2.2, 0.6, M.woodDark, -116.2, F2, 18.0);

  // ── 排水系统 ──
  pipe(g, [[STACK.x, -1.0, STACK.z], [STACK.x, F3 + 1.5, STACK.z]], 0.11, HP.sewer, { flanges: true, flangeEvery: 3 }); // 立管（伸顶通气）
  B.cyl(0.18, 0.12, M.steelDark, STACK.x, F3 + 1.55, STACK.z, 12);
  pipe(g, H.kitchenDrain, 0.06, HP.sewer, { flanges: false });
  pipe(g, H.toilet.slice(1), 0.1, HP.sewer, { flanges: false });
  pipe(g, H.basin.slice(1), 0.05, HP.sewer, { flanges: false });
  pipe(g, H.bath.slice(1), 0.05, HP.sewer, { flanges: false });
  pipe(g, H.washer.slice(1), 0.05, HP.sewer, { flanges: false });
  pipe(g, H.buildingDrain, 0.15, HP.sewer, { flanges: false });
  // 存水弯（U 形）
  pipe(g, [[-126, 1.06, 17.62], [-126, 0.8, 17.62], [-125.8, 0.75, 17.62], [-125.8, 0.86, 17.62], [-125.4, 0.8, 17.6]], 0.045, HP.sewer, { flanges: false, bend: 0.06, radial: 8 });
  // 室外检查井
  B.cyl(0.4, 1.4, M.concreteDark, -112, -0.7, 20, 12);
  B.cyl(0.45, 0.06, M.manhole, -112, 0.04, 20, 16);
  // ── 给水系统 ──
  pipe(g, H.supplyIn.slice(0, -1), 0.05, HP.supply, { flanges: false });
  pipe(g, H.supplyUp, 0.04, HP.supply, { flanges: false });
  pipe(g, H.supplyBasin, 0.03, HP.supply, { flanges: false });
  pipe(g, H.supplyWasher, 0.03, HP.supply, { flanges: false });
  // 水表井
  B.boxB(1.0, 0.9, 0.8, M.concreteDark, -112, -0.9, 24);
  B.boxB(1.0, 0.05, 0.8, M.valveCover, -112, 0.02, 24);
  B.cyl(0.12, 0.18, M.blueMachine, -112, -1.2, 24, 12);
  // 庭院
  B.boxB(W + 6, 0.04, 6, M.grassDark, cx, 0, z1 + 3);
  B.boxB(1.2, 0.05, 6, M.sidewalk, -113, 0, z1 + 3);
  for (let x = x0 - 2.5; x <= x1 + 2.5; x += 1.0) B.boxB(0.08, 0.9, 0.08, M.white, x, 0, z1 + 6.2);
  B.boxB(W + 5, 0.08, 0.06, M.white, cx, 0.75, z1 + 6.2);
  B.flush(g);

  // 剖切标识框线
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.1, F3 - F1 + 0.1, 0.02)),
    new THREE.LineBasicMaterial({ color: 0xff5a36 }),
  );
  frame.position.set(cx, (F1 + F3) / 2, z1);
  g.add(frame);
  ctx.pickables.push(g);
}
