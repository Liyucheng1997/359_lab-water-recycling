import * as THREE from 'three';
import { M, PIPE } from '../core/mats.js';
import { Batcher, pipe, mesh, makeLabel, railing } from '../core/geo.js';
import { SL, GAS } from '../flow/paths.js';
import { clarifier } from './common.js';

export function buildSludge(scene, ctx) {
  const g = new THREE.Group(); g.name = 'sludge'; g.userData.stage = 'sludge'; scene.add(g); ctx.pickables.push(g);
  const B = new Batcher();
  const sub = (txt, pos) => { const l = makeLabel(txt, null, 'sludge', pos); l.element.classList.add('sub'); g.add(l); };

  // 重力浓缩池
  clarifier(g, ctx, { cx: 40, cz: -28, r: 6, water: 0x4a3520, deep: 0x24180b, clear: 0x6b5534, speed: 0.07 });
  sub('污泥浓缩池', [40, 7.5, -28]);

  // 蛋形厌氧消化罐 ×2
  const prof = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const r = 7 * Math.sqrt(Math.max(0.035, 1 - ((t - 0.48) / 0.53) ** 2));
    prof.push(new THREE.Vector2(r, 1 + 19 * t));
  }
  prof.unshift(new THREE.Vector2(0.01, 1));
  const eggGeo = new THREE.LatheGeometry(prof, 64);
  for (const x of [62, 80]) {
    const egg = mesh(eggGeo, M.aluminium, x, 0, -28, g);
    B.cyl(3.4, 1.4, M.concrete, x, 0.7, -28, 32);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; B.beam([x + Math.cos(a) * 3.2, 0, -28 + Math.sin(a) * 3.2], [x + Math.cos(a) * 4.6, 6, -28 + Math.sin(a) * 4.6], 0.18, M.concrete); }
    B.cyl(1.5, 0.8, M.steel, x, 20.3, -28, 24);
    const ring = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; ring.push([x + Math.cos(a) * 2.6, 20, -28 + Math.sin(a) * 2.6]); }
    const pl = mesh(new THREE.RingGeometry(1.2, 2.7, 32), M.grating, x, 20, -28, g); pl.rotation.x = -Math.PI / 2;
    railing(B, ring, M.railing, { closed: true });
    // 外部循环加热管
    pipe(g, [[x + 3.1, 3.2, -30.5], [x + 3.1, 3.2, -24.5]], 0.15, PIPE.sludge, { flanges: false });
    egg.userData.stage = 'sludge';
    // 外保温层分段压条
    for (let i = 3; i < 40; i += 3) {
      const p = prof[i + 1];
      B.add(new THREE.TorusGeometry(p.x + 0.03, 0.05, 6, 64), M.steel, [x, p.y, -28], [Math.PI / 2, 0, 0]);
    }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const pts = prof.slice(2, 40).map((p) => [x + Math.cos(a) * (p.x + 0.03), p.y, -28 + Math.sin(a) * (p.x + 0.03)]);
      for (let i = 0; i < pts.length - 1; i++) B.beam(pts[i], pts[i + 1], 0.035, M.steel, 4);
    }
  }
  // 顶部连廊 + 楼梯塔
  B.bar([64.6, 20, -28], [77.4, 20, -28], 0.3, 1.4, M.galv);
  for (const s of [-0.7, 0.7]) railing(B, [[64.6, 20.15, -28 + s], [77.4, 20.15, -28 + s]], M.railing);
  const tx = 71, tz = -38;
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) B.boxB(0.25, 20.5, 0.25, M.galv, tx + dx, 0, tz + dz);
  for (let y = 2.5; y <= 20; y += 2.5) {
    B.boxB(3.4, 0.15, 3.4, M.galv, tx, y, tz);
    const sz = tz + ((y / 2.5) % 2 ? 0.7 : -0.7);
    B.bar([tx - 1.4, y - 2.5, sz], [tx + 1.4, y, sz], 0.12, 1.0, M.galv);
  }
  B.bar([tx, 20, tz + 1.6], [tx, 20, -28.7], 1.2, 0.25, M.galv);
  for (const s of [-0.6, 0.6]) railing(B, [[tx + s, 20.12, tz + 1.6], [tx + s, 20.12, -28.7]], M.railing);
  sub('蛋形厌氧消化罐', [71, 24.5, -28]);
  // 热交换/循环泵房
  B.boxB(6, 4, 4, M.plaster, 71, 0, -19.5);
  B.boxB(6.2, 0.25, 4.2, M.roofGrey, 71, 4, -19.5);

  // 双膜沼气柜
  B.cyl(7.3, 0.8, M.concrete, 98, 0.4, -30, 48);
  const dome = mesh(new THREE.SphereGeometry(7, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.gasDome, 98, 0.8, -30, g);
  dome.scale.set(1, 0.9, 1);
  B.cyl(0.3, 1.2, M.steel, 98, 7.4, -30, 12);
  sub('双膜沼气柜', [98, 10, -30]);
  // 火炬
  B.boxB(2.4, 0.5, 2.4, M.concrete, 110, 0, -38);
  B.cyl(0.45, 9, M.steelDark, 110, 4.75, -38, 16);
  B.cyl(0.7, 1.2, M.steel, 110, 9.6, -38, 16);
  const flame = new THREE.Group(); flame.position.set(110, 10.2, -38); g.add(flame);
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.6, 16, 1, true), M.flame); f1.position.y = 1.3; flame.add(f1);
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 12, 1, true), M.flameCore); f2.position.y = 0.8; flame.add(f2);
  ctx.anim.push((t) => { const s = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06; flame.scale.set(1 + Math.sin(t * 9) * 0.05, s, 1); flame.rotation.y = t * 0.8; });
  const fl = new THREE.PointLight(0xff9a40, 8, 18, 2); fl.position.set(110, 12, -38); g.add(fl);
  sub('沼气火炬', [110, 15, -38]);
  // 沼气热电联产（CHP）
  B.boxB(8, 3, 3.2, M.greenMachine, 100, 0, -17.8);
  B.boxB(3, 1.2, 2.6, M.greyMachine, 97.5, 3, -17.8);
  B.cyl(0.25, 5, M.steelDark, 103.5, 5.5, -17, 12);
  for (let k = 0; k < 4; k++) B.boxB(0.12, 1.6, 0.6, M.black, 96.5 + k * 1.6, 0.8, -16.18);
  sub('沼气发电（CHP）', [100, 7.5, -17.8]);

  // 脱水机房
  const dx0 = 116, dx1 = 128, dz0 = -33, dz1 = -23, H = 8;
  B.boxB(dx1 - dx0, 0.3, dz1 - dz0, M.concreteDark, 122, 0, -28);
  B.boxB(dx1 - dx0, H, 0.25, M.plaster, 122, 0, dz0);
  B.boxB(0.25, H, dz1 - dz0, M.plaster, dx0, 0, -28);
  B.boxB(0.25, H, dz1 - dz0, M.plaster, dx1, 0, -28);
  B.boxB(dx1 - dx0 + 0.4, 0.3, dz1 - dz0 + 0.4, M.roofGrey, 122, H, -28);
  B.boxB(dx1 - dx0 - 0.3, H - 0.3, 0.06, M.glass, 122, 0.3, dz1);
  for (const z of [-30.5, -25.5]) {
    B.boxB(5.5, 1.0, 1.4, M.galv, 121, 0.3, z);
    B.cyl(0.65, 4.2, M.steel, 121, 2.0, z, 24, [0, 0, Math.PI / 2]);
    B.boxB(1.2, 1.3, 1.2, M.blueMachine, 124.4, 1.3, z);
  }
  for (const x of [117.4, 118.9]) B.cyl(0.6, 2.4, M.white, x, 1.5, -24.4, 16);
  // 泥饼输送 + 卡车
  B.bar([122, 3, -32.6], [122, 4.5, -37.2], 0.9, 0.35, M.greyMachine);
  truck(B, 122, -39.5);
  B.boxB(1.0, 0.8, 2.0, M.sludge, 122, 2.5, -39.5);
  sub('污泥脱水机房', [122, 10.5, -28]);
  B.flush(g);

  for (const k of ['primarySludge', 'toDigester', 'toDewater']) pipe(g, SL[k].pts, SL[k].pipe.r, PIPE.sludge, { flangeEvery: 6 });
  for (const k of Object.keys(GAS)) pipe(g, GAS[k], 0.18, PIPE.gas, { flangeEvery: 4 });

  g.add(makeLabel('污泥处理与资源化', 11, 'sludge', [80, 27, -28]));
}

function truck(B, x, z) {
  B.boxB(2.4, 0.5, 7, M.steelDark, x, 0.6, z);
  B.boxB(2.4, 2.2, 2, M.orange, x, 1.1, z + 2.9);
  B.boxB(2.2, 0.8, 0.06, M.glassBuilding, x, 2.2, z + 3.92);
  B.boxB(2.5, 1.6, 4.6, M.railing, x, 1.1, z - 1.0);
  for (const dz of [2.8, -0.6, -2.4]) for (const s of [-1.15, 1.15]) B.cyl(0.5, 0.35, M.rubber, x + s, 0.5, z + dz, 16, [0, 0, Math.PI / 2]);
}
