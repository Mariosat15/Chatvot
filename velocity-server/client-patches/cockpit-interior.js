/* CHARTVOLT PATCH (14 Oct 2026, owner: "add another camera inside the cockpit meaning you need to design
 * interior as well").
 * A procedural cockpit that rides on the camera for the 'interior' view: a dashboard across the bottom, a
 * glowing lip, a centre screen with live speed / boost / hull, two canopy pillars and a header bar.
 * Pure presentation - it reads the simulation and never writes to it.
 *
 * Coordinates are camera space: -Z is where the camera looks, +Y is up, units are metres. At the view's
 * 80 degree field of view the frame at z = -1.1 is ~0.92 m from centre to top, so the dashboard fills
 * roughly the bottom quarter and the road stays clear.
 * CHARTVOLT PATCH (14 Oct 2026, owner: "in cockpit in portrait i cant see the frame of the cockpit also the
 * dashboard is hidden in both views in landscape and portrait"): the layout is fitted to the screen.
 * Reason: the pillars sat at x ~1.25 m, and a portrait phone sees only ~0.4 m either side at that depth, so
 * they were off screen; and the dashboard filled the bottom fifth of the view, which on a phone is exactly
 * where the steering and pedal buttons are. interiorPlacement() pulls the pillars inside the visible width
 * and lifts the dashboard clear of the controls. On a desktop it returns the original layout unchanged. */
import * as T from 'three';

/** Readout text, kept pure so it can be tested without a canvas. */
export function interiorReadout(sim) {
  const speed = Number.isFinite(sim?.speed) ? Math.round(Math.abs(sim.speed) * 3.6) : 0;
  const pct = value => Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value * 100))) : 0;
  return {speed: String(speed), boost: pct(sim?.energy), hull: pct(sim?.hull)};
}

/** Share of the screen height, from the bottom, covered by touch controls and the bottom HUD per layout. */
export const INTERIOR_RESERVE = Object.freeze({portrait: .31, landscape: .34, tablet: .12, desktop: 0});

/** How much of the bottom of the screen the cockpit must keep its dashboard above. No touch pads, no reserve. */
export function interiorReserve(layout, touch) {
  if (!touch) return 0;
  return Object.hasOwn(INTERIOR_RESERVE, layout) ? INTERIOR_RESERVE[layout] : INTERIOR_RESERVE.landscape;
}

/** Desktop layout, camera space. screenBottomY/screenDepth are the readout's lower edge after its -.5 rad tilt. */
const BASE = Object.freeze({pillarBottomX: 1.25, pillarTopX: .72, sideLightX: .62, screenBottomY: -.4865, screenDepth: .747});
/** Where the frame may sit across the screen (1 = the edge) and how far above the reserve the screen's lower edge goes. */
const EDGE = Object.freeze({pillarBottom: .94, pillarTop: .8, sideLight: .7, screenClear: .03});

/**
 * Camera-space placement of the parts that depend on the screen: pillar x at the dash and at the header,
 * the dash side lights, and `lift`, the height the whole dashboard is raised by.
 * Reason: a point at depth z shows at ndcY = y / (z * tan(fov / 2)), ndcX = x / (z * tan(fov / 2) * aspect),
 * so clamping each part to an ndc limit keeps it on screen at any aspect without moving it where it already fits.
 */
export function interiorPlacement({aspect, fov, reserve}) {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const t = Math.tan(((Number.isFinite(fov) && fov > 0 ? fov : 80) * Math.PI / 180) / 2);
  const r = Number.isFinite(reserve) ? Math.max(0, Math.min(.6, reserve)) : 0;
  const across = (edge, depth) => edge * depth * t * a;
  const neededNdc = -1 + 2 * r + (r > 0 ? EDGE.screenClear : 0);
  const screenNdc = BASE.screenBottomY / (BASE.screenDepth * t);
  return {
    pillarBottomX: Math.min(BASE.pillarBottomX, across(EDGE.pillarBottom, 1.05)),
    pillarTopX: Math.min(BASE.pillarTopX, across(EDGE.pillarTop, 1.22)),
    sideLightX: Math.min(BASE.sideLightX, across(EDGE.sideLight, .66)),
    lift: Math.max(0, (neededNdc - screenNdc) * BASE.screenDepth * t),
  };
}

/** A unit-length box along +Z, stretched and aimed by placeStrut, so the frame can be refitted without new geometry. */
function strut(material, thickness) {
  return new T.Mesh(new T.BoxGeometry(thickness, thickness, 1), material);
}
/** Runs `mesh` from `a` to `b` (points in its parent's space). */
function placeStrut(mesh, a, b) {
  const from = new T.Vector3(...a), to = new T.Vector3(...b);
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.scale.set(1, 1, Math.max(1e-3, from.distanceTo(to)));
  // Reason: lookAt aims at a WORLD point, and these parts live in the camera's moving space, so aim with a local quaternion.
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), to.sub(from).normalize());
}

export function createCockpitInterior(camera, scene) {
  // Reason: a child of the camera is only drawn if the camera itself is in the scene graph.
  if (!camera.parent) scene.add(camera);
  const group = new T.Group();
  group.name = 'cockpit-interior';
  group.visible = false;

  const shell = new T.MeshStandardMaterial({color: 0x0b1622, roughness: .62, metalness: .45, emissive: 0x041019, emissiveIntensity: 1});
  const frame = new T.MeshStandardMaterial({color: 0x16222e, roughness: .4, metalness: .7, emissive: 0x050c14, emissiveIntensity: 1});
  const glow = new T.MeshBasicMaterial({color: 0x5fe8ff, toneMapped: false});
  const amber = new T.MeshBasicMaterial({color: 0xffb347, toneMapped: false});

  const dash = new T.Mesh(new T.BoxGeometry(2.7, .34, .9), shell);
  dash.position.set(0, -.68, -1.08);
  dash.rotation.x = -.14;
  const hood = new T.Mesh(new T.BoxGeometry(.9, .07, .34), frame);
  // Reason: hood and screen sit .05 higher than first built, so the readout clears the dash top instead of half-hiding in it.
  hood.position.set(0, -.42, -.9);
  hood.rotation.x = -.42;
  const lip = new T.Mesh(new T.BoxGeometry(2.3, .012, .02), glow);
  lip.position.set(0, -.5, -.64);
  const sideLights = [-1, 1].map(side => {
    const light = new T.Mesh(new T.BoxGeometry(.2, .01, .02), amber);
    light.position.set(side * .62, -.49, -.66);
    return light;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const screen = new T.Mesh(new T.PlaneGeometry(.44, .22), new T.MeshBasicMaterial({map: texture, toneMapped: false, transparent: true}));
  screen.position.set(0, -.39, -.8);
  screen.rotation.x = -.5;

  const pillars = [-1, 1].map(() => strut(frame, .07));
  const header = strut(frame, .06);
  const headerGlow = strut(glow, .008);
  const sills = [-1, 1].map(() => strut(frame, .09));
  // Reason: the dashboard parts move together, so they share one group that interiorPlacement lifts.
  const dashboard = new T.Group();
  dashboard.add(dash, hood, lip, ...sideLights, screen);

  group.add(dashboard, ...pillars, header, headerGlow, ...sills);
  group.traverse(object => {
    if (!object.isMesh) return;
    // Reason: the camera is the parent, so the interior is always in view; culling it would only cost the test.
    object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = false;
    object.renderOrder = 10;
  });
  // Reason: the readout is the part nearest the pilot; the hood bezel above it crossed the digits at some heights, so it always draws on top.
  screen.renderOrder = 11;
  screen.material.depthTest = false;
  camera.add(group);

  let fitted = '';
  function fit() {
    const root = typeof document === 'undefined' ? undefined : document.documentElement;
    const reserve = interiorReserve(root?.dataset.layout, root?.dataset.touch === '1');
    const key = `${camera.aspect.toFixed(3)}|${Math.round(camera.fov)}|${reserve}`;
    if (key === fitted) return;
    fitted = key;
    const p = interiorPlacement({aspect: camera.aspect, fov: camera.fov, reserve});
    dashboard.position.y = p.lift;
    sideLights.forEach((light, i) => { light.position.x = (i ? 1 : -1) * p.sideLightX; });
    pillars.forEach((pillar, i) => { const side = i ? 1 : -1; placeStrut(pillar, [side * p.pillarBottomX, -.52 + p.lift, -1.05], [side * p.pillarTopX, .8, -1.22]); });
    placeStrut(header, [-(p.pillarTopX + .02), .8, -1.22], [p.pillarTopX + .02, .8, -1.22]);
    placeStrut(headerGlow, [-p.pillarTopX * .82, .765, -1.2], [p.pillarTopX * .82, .765, -1.2]);
    sills.forEach((sill, i) => { const side = i ? 1 : -1; placeStrut(sill, [side * p.pillarBottomX * 1.056, -.5 + p.lift, -1.05], [side * p.pillarBottomX * 1.12, -.36 + p.lift, .3]); });
  }
  fit();

  const ctx = canvas.getContext('2d');
  let since = 1, lastText = '';
  function draw(readout) {
    const text = `${readout.speed}|${readout.boost}|${readout.hull}`;
    if (text === lastText || !ctx) return;
    lastText = text;
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = 'rgba(3,14,28,.82)';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = 'rgba(95,232,255,.6)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 252, 124);
    ctx.fillStyle = '#e9fbff';
    ctx.font = 'bold 54px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(readout.speed, 128, 62);
    ctx.fillStyle = '#8fb9c9';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('KM/H', 128, 82);
    const bar = (y, value, colour) => {
      ctx.fillStyle = 'rgba(143,185,201,.2)'; ctx.fillRect(24, y, 208, 8);
      ctx.fillStyle = colour; ctx.fillRect(24, y, 208 * value / 100, 8);
    };
    bar(96, readout.boost, '#59d8ff');
    bar(110, readout.hull, '#21e3b4');
    texture.needsUpdate = true;
  }

  return {
    group,
    /** Reason: redrawing the texture every frame is a GPU upload per frame on a phone; ten a second reads live. */
    update(sim, dt) {
      fit();
      since += Number.isFinite(dt) ? dt : 0;
      if (since < .1) return;
      since = 0;
      draw(interiorReadout(sim));
    },
  };
}
