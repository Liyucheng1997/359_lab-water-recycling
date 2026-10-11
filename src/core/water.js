import * as THREE from 'three';

export const waterTime = { value: 0 };
const SUN = new THREE.Vector3(0.47, 0.78, 0.31).normalize();

const vert = /* glsl */`
uniform float uTime; uniform float uChop;
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += (sin(wp.x * 0.6 + uTime * 1.3) + sin(wp.z * 0.8 - uTime * 1.1)) * 0.025 * uChop;
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const frag = /* glsl */`
uniform float uTime; uniform vec3 uColor; uniform vec3 uDeep; uniform float uOpacity;
uniform vec2 uFlow; uniform float uChop; uniform float uFoam; uniform vec3 uSun; uniform float uSpec;
varying vec3 vWorld;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
float hgt(vec2 p){ vec2 q = p - uFlow * uTime; return fbm(q * 0.35 + vec2(uTime * 0.05)) + 0.5 * fbm(q * 0.9 - vec2(uTime * 0.08, 0.0)); }
void main(){
  vec2 p = vWorld.xz;
  float e = 0.15;
  float h0 = hgt(p), hx = hgt(p + vec2(e, 0.0)), hz = hgt(p + vec2(0.0, e));
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.55 * uChop, 1.0, -(hz - h0) / e * 0.55 * uChop));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 sky = vec3(0.55, 0.72, 0.92);
  vec3 col = mix(uDeep, uColor, clamp(0.35 + 0.65 * h0, 0.0, 1.0));
  col = mix(col, sky, fres * 0.5);
  vec3 hv = normalize(uSun + v);
  col += pow(max(dot(n, hv), 0.0), 140.0) * 1.4 * uSpec;
  float f1 = fbm(p * 1.4 + vec2(uTime * 0.7, -uTime * 0.5));
  float f2 = noise(p * 6.0 + vec2(-uTime * 1.5, uTime * 1.1));
  float foam = smoothstep(0.55, 0.78, f1 * 0.75 + f2 * 0.35) * uFoam;
  col = mix(col, vec3(0.93, 0.92, 0.86), foam);
  gl_FragColor = vec4(col, clamp(uOpacity + foam * 0.3 + fres * 0.15, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * 动态水面材质
 * @param {number} color 浅色（表层）
 * @param {object} o deep: 深色, opacity, flow:[x,z], chop: 波浪强度, foam: 泡沫(曝气)
 */
export function waterMat(color, o = {}) {
  const c = new THREE.Color(color);
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: waterTime,
      uColor: { value: c },
      uDeep: { value: o.deep != null ? new THREE.Color(o.deep) : c.clone().multiplyScalar(0.55) },
      uOpacity: { value: o.opacity ?? 0.9 },
      uFlow: { value: new THREE.Vector2(o.flow?.[0] ?? 0, o.flow?.[1] ?? 0) },
      uChop: { value: o.chop ?? 1 },
      uFoam: { value: o.foam ?? 0 },
      uSpec: { value: o.spec ?? 1 },
      uSun: { value: SUN },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
  });
}

/** 剖切显示用的水体（半透明体积） */
export function waterVolMat(color, opacity = 0.42) {
  return new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.15, metalness: 0, depthWrite: false });
}

/** 水平水面平面 */
export function waterPlane(w, d, mat, x, y, z, parent) {
  const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(d / 2)));
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.renderOrder = 3;
  parent?.add(m);
  return m;
}
export function waterDisc(r, mat, x, y, z, parent, rIn = 0) {
  const g = rIn > 0 ? new THREE.RingGeometry(rIn, r, 64, 4) : new THREE.CircleGeometry(r, 64);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.renderOrder = 3;
  parent?.add(m);
  return m;
}
