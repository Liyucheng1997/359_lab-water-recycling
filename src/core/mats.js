import * as THREE from 'three';
import { makeTextures } from './textures.js';

export const T = makeTextures();

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.0, ...o });

export const M = {
  concrete: std(0xd2cfc7, { map: T.concrete, roughness: 0.92 }),
  concreteDark: std(0x9a958d, { map: T.concrete, roughness: 0.95 }),
  concreteCut: std(0x7c766d, { roughness: 1 }),
  steel: std(0xa7b0b8, { metalness: 0.75, roughness: 0.35 }),
  steelDark: std(0x4b525a, { metalness: 0.6, roughness: 0.45 }),
  galv: std(0xc7ccd1, { metalness: 0.65, roughness: 0.4 }),
  railing: std(0xf2b630, { roughness: 0.55, metalness: 0.2 }),
  blueMachine: std(0x2f6db5, { roughness: 0.45, metalness: 0.3 }),
  greenMachine: std(0x3b8f6a, { roughness: 0.5, metalness: 0.25 }),
  greyMachine: std(0x7d8792, { roughness: 0.5, metalness: 0.35 }),
  orange: std(0xe8742a, { roughness: 0.55 }),
  red: std(0xc8382f, { roughness: 0.55 }),
  white: std(0xf2f2ef, { roughness: 0.6 }),
  black: std(0x202224, { roughness: 0.7 }),
  rubber: std(0x18191b, { roughness: 0.9 }),
  wood: std(0xa57c52, { roughness: 0.85 }),
  woodDark: std(0x6b4a2e, { roughness: 0.85 }),
  brick: std(0xa9573e, { roughness: 0.9 }),
  roofTile: std(0x9a3f2f, { roughness: 0.75 }),
  roofGrey: std(0x5d646c, { roughness: 0.7 }),
  roofFlat: std(0x8c8c88, { roughness: 0.95 }),
  plaster: std(0xe6ddd0, { roughness: 0.9 }),
  plasterWarm: std(0xd8c4a2, { roughness: 0.9 }),
  tile: std(0xa9cbd8, { roughness: 0.3 }),
  ceramic: std(0xfafafa, { roughness: 0.15, metalness: 0.05 }),
  chrome: std(0xe6e9ec, { metalness: 1.0, roughness: 0.12 }),
  membrane: std(0xf0efe8, { roughness: 0.6 }),
  carbon: std(0x1d1e20, { roughness: 1 }),
  sand: std(0xd8c49a, { map: T.sand, roughness: 1 }),
  gravel: std(0x8f8c86, { roughness: 1 }),
  soilTop: std(0x6e5a40, { roughness: 1 }),
  grassDark: std(0x4f7a37, { roughness: 1 }),
  bermSoil: std(0x7a6a4a, { roughness: 1 }),
  rock: std(0x8a8478, { roughness: 0.95, flatShading: true }),
  sludge: std(0x3f2c1a, { roughness: 0.9 }),
  asphalt: std(0x45484c, { map: T.asphalt, roughness: 0.95 }),
  sidewalk: std(0xbdbab3, { roughness: 0.95 }),
  marking: std(0xf2f2f2, { roughness: 0.7 }),
  markingY: std(0xf2c230, { roughness: 0.7 }),
  aluminium: std(0xcfd5da, { metalness: 0.8, roughness: 0.3 }),
  gasDome: std(0xe3e6e2, { roughness: 0.55 }),
  glassFrame: std(0x5d6871, { metalness: 0.6, roughness: 0.4 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false, side: THREE.DoubleSide }),
  glassBuilding: std(0x7fa7c4, { metalness: 0.4, roughness: 0.15 }),
  polycarb: new THREE.MeshStandardMaterial({ color: 0xdfeaf2, transparent: true, opacity: 0.32, roughness: 0.3, depthWrite: false, side: THREE.DoubleSide }),
  grating: new THREE.MeshStandardMaterial({ color: 0x9aa1a8, map: T.grating, alphaTest: 0.5, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide }),
  drumMesh: new THREE.MeshStandardMaterial({ color: 0xd9e0e6, map: T.mesh, alphaTest: 0.4, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }),
  manhole: new THREE.MeshStandardMaterial({ map: T.manhole, roughness: 0.6, metalness: 0.5 }),
  valveCover: new THREE.MeshStandardMaterial({ map: T.valveCover, roughness: 0.6, metalness: 0.5 }),
  uvLamp: new THREE.MeshStandardMaterial({ color: 0xe8dcff, emissive: 0xa070ff, emissiveIntensity: 3.2, roughness: 0.2 }),
  lampGlow: new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe2a0, emissiveIntensity: 1.6 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  flameCore: new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  ledGreen: new THREE.MeshStandardMaterial({ color: 0x40ff80, emissive: 0x30ff70, emissiveIntensity: 2 }),
  carPaint: [0xd23c3c, 0x2b6cd6, 0xf2f2f2, 0x1f1f22, 0x9aa3ab, 0xf0b429, 0x3b8f6a].map((c) => std(c, { metalness: 0.5, roughness: 0.35 })),
};

M.facades = T.facades.map((map) => std(0xffffff, { map, roughness: 0.75 }));

// 水管外壳（半透明，透视内部水流）。kind → 颜色遵循常见管线标识惯例
const pipeMat = (color, opacity = 0.42) => new THREE.MeshStandardMaterial({
  color, transparent: true, opacity, roughness: 0.35, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide,
});
export const PIPE = {
  sewer: pipeMat(0xb07a45),    // 污水：棕
  supply: pipeMat(0x2f86ea),   // 自来水：蓝
  reclaim: pipeMat(0x8a5cd6),  // 再生水：紫
  raw: pipeMat(0x2aa198),      // 原水/工艺水：青
  sludge: pipeMat(0x6b4426, 0.55), // 污泥：深棕
  gas: pipeMat(0xe7b416, 0.6),  // 沼气：黄
  air: std(0xb8c2cc, { roughness: 0.35, metalness: 0.7 }),     // 空气：银灰
  hot: pipeMat(0xe0533a, 0.6),  // 热水：红
};
PIPE.flange = std(0x59616a, { metalness: 0.7, roughness: 0.35 });
export const PIPE_SHELLS = [PIPE.sewer, PIPE.supply, PIPE.reclaim, PIPE.raw, PIPE.sludge, PIPE.hot, PIPE.gas];
for (const m of PIPE_SHELLS) m.userData.baseOpacity = m.opacity;
/** 细管（室内）使用更高不透明度，便于辨认 */
export function pipeVariant(base, opacity) {
  const m = base.clone(); m.opacity = opacity; m.userData.baseOpacity = opacity; PIPE_SHELLS.push(m); return m;
}

// 地表材质（可调透明度以透视地下管网）
export const SURFACE = [];
export function surfaceMat(m) { SURFACE.push(m); m.userData.baseOpacity = 1; return m; }
