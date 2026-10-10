// CHARTVOLT PATCH (28 Sep 2026, owner: "make the existing tracks more dense, feel more alive").
// Trackside life for every circuit: chaser lights along both barriers, fluttering pennants,
// hovering camera drones, weather-style motes around the camera and, where an environment asks
// for it, aurora curtains in the sky. Rendering only - nothing here reads or changes the race.
//
// Reason: each effect is ONE draw call animated on the GPU from a single shared clock, so the
// whole module costs a handful of draws whatever the track length. The motes live in a box that
// follows the camera rather than being scattered along the course, which is what makes a few
// thousand points read as weather instead of a sparse dust over five kilometres.
import * as T from 'three';
import {HALF_WIDTH} from './track.js';
import {rng} from './tracks.js';

const LIGHT_SPACING = 10;
const FLAG_SPACING = 80;
const DRONES = 10;
const MOTE_BOX = new T.Vector3(260, 70, 260);

// Weather per scenery type. Unknown types fall back to neon motes in the circuit's accent colour.
const MOTES = {
  ice: {color: 0xeef7ff, drift: [1.5, -6, .8], size: .45, sway: 1.6, opacity: .85, count: 2600},
  volcano: {color: 0xff7a2e, drift: [0, 5, 0], size: .34, sway: 2.4, opacity: .9, count: 1800},
  jungle: {color: 0xd8ff7a, drift: [.4, .6, .3], size: .3, sway: 3, opacity: .8, count: 900},
  coast: {color: 0xfff4d6, drift: [3, .4, 1], size: .22, sway: 2, opacity: .45, count: 900},
  desert: {color: 0xf2c48a, drift: [8, .3, 2], size: .26, sway: 1.2, opacity: .5, count: 1600},
  canyon: {color: 0xf0a878, drift: [6, .3, 2], size: .26, sway: 1.2, opacity: .45, count: 1400},
  alpine: {color: 0xf3f8ff, drift: [1, -3.5, .5], size: .35, sway: 1.4, opacity: .7, count: 1800}
};

function pulseMaterial(view, base, fragment) {
  const m = new T.MeshBasicMaterial({color: 0xffffff, toneMapped: false, side: base.side ?? T.FrontSide});
  m.onBeforeCompile = (s) => {
    s.uniforms.uLife = view.trackLifeClock;
    s.vertexShader = 'attribute float aPhase;\nuniform float uLife;\nvarying float vPulse;\n' + s.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n' + base.vertex);
    s.fragmentShader = 'varying float vPulse;\n' + s.fragmentShader.replace(
      '#include <color_fragment>', '#include <color_fragment>\n' + fragment);
  };
  return m;
}

function phases(geometry, count) {
  const a = new T.InstancedBufferAttribute(new Float32Array(count), 1);
  geometry.setAttribute('aPhase', a);
  return a;
}

function finish(view, mesh, count) {
  mesh.frustumCulled = false;
  mesh.userData.environmentFullCount = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  view.scene.add(mesh);
  return mesh;
}

// Beads on top of both barriers; a bright wave runs along the course in the racing direction.
function buildChaserLights(view, colors, basis) {
  const track = view.track, per = Math.floor(track.length / LIGHT_SPACING), count = per * 2;
  const geo = new T.BoxGeometry(.34, .2, 1.5), phase = phases(geo, count);
  const mat = pulseMaterial(view, {vertex: 'vPulse=pow(.5+.5*sin(aPhase*.045-uLife*7.),8.);'}, 'diffuseColor.rgb*=.3+2.8*vPulse;');
  const mesh = new T.InstancedMesh(geo, mat, count);
  let i = 0;
  for (let k = 0; k < per; k++) {
    const d = k * LIGHT_SPACING, f = track.frame(d);
    for (const side of [-1, 1]) {
      basis.makeBasis(f.right, f.up, f.forward);
      basis.setPosition(f.p.clone().addScaledVector(f.right, side * (HALF_WIDTH + .35)).addScaledVector(f.up, .84));
      mesh.setMatrixAt(i, basis);
      mesh.setColorAt(i, side < 0 ? colors.accent : colors.main);
      phase.array[i++] = d;
    }
  }
  return finish(view, mesh, count);
}

// Pennants on thin poles just outside the barrier, alternating sides, streaming back from the race.
function buildPennants(view, colors, basis, random) {
  const track = view.track, count = Math.max(8, Math.floor(track.length / FLAG_SPACING));
  const poleGeo = new T.CylinderGeometry(.08, .12, 7, 6).translate(0, 3.5, 0);
  const flagGeo = new T.PlaneGeometry(2.6, 1.3, 10, 1).translate(1.3, 6.2, 0), phase = phases(flagGeo, count);
  const poles = new T.InstancedMesh(poleGeo, new T.MeshStandardMaterial({color: 0x3b4658, metalness: .8, roughness: .35}), count);
  const flagMat = pulseMaterial(view, {side: T.DoubleSide, vertex: 'vPulse=.5+.5*sin(uLife*2.+aPhase);transformed.z+=sin(position.x*2.2-uLife*6.+aPhase)*position.x*.16;'}, 'diffuseColor.rgb*=.75+.5*vPulse;');
  const flags = new T.InstancedMesh(flagGeo, flagMat, count), back = new T.Vector3();
  for (let i = 0; i < count; i++) {
    const f = track.frame((i + .5) * track.length / count), side = i % 2 ? 1 : -1;
    const at = f.p.clone().addScaledVector(f.right, side * (HALF_WIDTH + 4)).addScaledVector(f.up, -.2);
    basis.makeBasis(f.right, f.up, f.forward).setPosition(at);
    poles.setMatrixAt(i, basis);
    basis.makeBasis(back.copy(f.forward).negate(), f.up, f.right).setPosition(at);
    flags.setMatrixAt(i, basis);
    flags.setColorAt(i, (i >> 1) % 2 ? colors.main : colors.accent);
    phase.array[i] = random() * 6.283;
  }
  finish(view, poles, count);
  return finish(view, flags, count);
}

// Camera drones: a few hold station over corners, the rest patrol slowly in both directions.
function buildDrones(view, colors, random) {
  const body = new T.InstancedMesh(new T.BoxGeometry(1.2, .34, 1.2), new T.MeshStandardMaterial({color: 0x1b2433, metalness: .7, roughness: .3}), DRONES);
  const ring = new T.InstancedMesh(new T.TorusGeometry(1.05, .08, 6, 20).rotateX(Math.PI / 2), new T.MeshBasicMaterial({color: colors.main.clone().multiplyScalar(2.4), toneMapped: false}), DRONES);
  view.trackDrones = {body, ring, frame: view.track.frame(0), matrix: new T.Matrix4(), q: new T.Quaternion(), tilt: new T.Quaternion(),
    pos: new T.Vector3(), axis: new T.Vector3(1, 0, 0), one: new T.Vector3(1, 1, 1),
    list: Array.from({length: DRONES}, (_, i) => ({
      base: random() * view.track.length,
      speed: i % 3 === 0 ? 0 : (14 + random() * 10) * (i % 2 ? 1 : -1),
      lane: (random() < .5 ? -1 : 1) * (HALF_WIDTH + 3 + random() * 6),
      height: 8 + random() * 7, bob: random() * 6.283
    }))};
  for (const m of [body, ring]) { m.frustumCulled = false; view.scene.add(m); }
}

function updateDrones(view, t) {
  const d = view.trackDrones;
  if (!d) return;
  const {frame, matrix, q, tilt, pos, axis, one} = d;
  d.list.forEach((drone, i) => {
    view.track.frame(drone.base + drone.speed * t, frame);
    pos.copy(frame.p).addScaledVector(frame.right, drone.lane).addScaledVector(frame.up, drone.height + Math.sin(t * 1.3 + drone.bob) * .8);
    matrix.makeBasis(frame.right, frame.up, frame.forward);
    q.setFromRotationMatrix(matrix).multiply(tilt.setFromAxisAngle(axis, Math.sign(drone.speed) * .12 + Math.sin(t + drone.bob) * .04));
    matrix.compose(pos, q, one);
    d.body.setMatrixAt(i, matrix);
    d.ring.setMatrixAt(i, matrix);
  });
  d.body.instanceMatrix.needsUpdate = d.ring.instanceMatrix.needsUpdate = true;
}

function buildMotes(view, colors, random) {
  const style = MOTES[view.environment.type] || {color: colors.accent.getHex(), drift: [0, 1.2, 0], size: .28, sway: 2, opacity: .7, count: 1400};
  const seeds = new Float32Array(style.count * 3);
  for (let i = 0; i < seeds.length; i++) seeds[i] = random();
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(style.count * 3), 3));
  geo.setAttribute('aSeed', new T.BufferAttribute(seeds, 3));
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false,
    uniforms: {uLife: view.trackLifeClock, uCenter: {value: new T.Vector3()}, uBox: {value: MOTE_BOX}, uDrift: {value: new T.Vector3(...style.drift)},
      uSize: {value: style.size}, uSway: {value: style.sway}, uColor: {value: new T.Color(style.color)}, uOpacity: {value: style.opacity}},
    vertexShader: `attribute vec3 aSeed;uniform float uLife,uSize,uSway;uniform vec3 uCenter,uBox,uDrift;varying float vFade;
void main(){vec3 p=aSeed*uBox+uDrift*uLife*(.6+.8*aSeed.y);p.x+=sin(uLife*.7+aSeed.z*40.)*uSway;p.z+=cos(uLife*.6+aSeed.x*40.)*uSway;
p=mod(p-uCenter+uBox*.5,uBox)+uCenter-uBox*.5;vec3 q=abs(p-uCenter)/(uBox*.5);vFade=(1.-smoothstep(.65,1.,max(q.x,max(q.y,q.z))))*(.6+.4*sin(uLife*2.+aSeed.x*90.));
vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(48.,uSize*(.6+aSeed.z)*300./max(1.,-mv.z));gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform vec3 uColor;uniform float uOpacity;varying float vFade;void main(){float a=smoothstep(.5,0.,length(gl_PointCoord-.5));gl_FragColor=vec4(uColor,a*vFade*uOpacity);}`
  });
  const points = new T.Points(geo, mat);
  points.frustumCulled = false;
  points.userData.moteCount = style.count;
  view.trackMotes = points;
  view.scene.add(points);
}

// Aurora curtains, only for environments that set aurora:true. Placed far out around the course.
function buildAurora(view) {
  if (!view.environment.aurora) return;
  const pts = Array.from({length: 40}, (_, i) => view.track.frame(view.track.length * i / 40).p);
  const center = pts.reduce((a, p) => a.add(p), new T.Vector3()).multiplyScalar(1 / pts.length);
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false, toneMapped: false,
    uniforms: {uLife: view.trackLifeClock},
    vertexShader: `uniform float uLife;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.x*6.+uLife*.15)*140.+sin(uv.x*17.-uLife*.2)*40.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float uLife;varying vec2 vUv;void main(){float x=vUv.x*28.+sin(vUv.x*9.+uLife*.25)*2.;float curtain=pow(.5+.5*sin(x+uLife*.4),3.)*(.6+.4*sin(vUv.x*61.-uLife*.7));
float body=smoothstep(0.,.25,vUv.y)*pow(1.-vUv.y,1.6)*smoothstep(0.,.08,vUv.x)*smoothstep(1.,.92,vUv.x);vec3 c=mix(vec3(.15,1.,.6),vec3(.62,.35,1.),smoothstep(.35,.95,vUv.y));
gl_FragColor=vec4(c,curtain*body*.55);}`
  });
  for (let i = 0; i < 3; i++) {
    const m = new T.Mesh(new T.PlaneGeometry(2600, 420, 96, 1), mat), a = i * 2.1 + .4;
    m.position.set(center.x + Math.cos(a) * 2300, 640 + i * 70, center.z + Math.sin(a) * 2300);
    m.lookAt(center.x, m.position.y, center.z);
    m.frustumCulled = false;
    m.renderOrder = -1;
    view.scene.add(m);
  }
}

export function buildTrackLife(view) {
  view.trackLifeClock = {value: 0};
  const random = rng((view.track.content?.seed ?? 1) ^ 0x71fe);
  const colors = {main: new T.Color(view.track.definition.color).multiplyScalar(1.6), accent: new T.Color(view.track.definition.accent).multiplyScalar(1.6)};
  const basis = new T.Matrix4();
  buildChaserLights(view, colors, basis);
  buildPennants(view, colors, basis, random);
  buildDrones(view, colors, random);
  buildMotes(view, colors, random);
  buildAurora(view);
  view.environmentStats.trackLife = {lights: Math.floor(view.track.length / LIGHT_SPACING) * 2, drones: DRONES, motes: view.trackMotes.userData.moteCount, aurora: Boolean(view.environment.aurora)};
}

export function updateTrackLife(view, t) {
  if (!view.trackLifeClock) return;
  view.trackLifeClock.value = t;
  updateDrones(view, t);
  const motes = view.trackMotes;
  if (motes) {
    motes.material.uniforms.uCenter.value.copy(view.camera.position).y += 15;
    const low = view.graphicsQuality?.textures === 'low';
    motes.geometry.setDrawRange(0, Math.ceil(motes.userData.moteCount * (low ? .45 : 1)));
  }
}
