/* CHARTVOLT PATCH (14 Oct 2026, owner: "add another camera inside the cockpit meaning you need to design
 * interior as well").
 * A procedural cockpit that rides on the camera for the 'interior' view: a dashboard across the bottom, a
 * glowing lip, a centre screen with live speed / boost / hull, two canopy pillars and a header bar.
 * Pure presentation - it reads the simulation and never writes to it.
 *
 * Coordinates are camera space: -Z is where the camera looks, +Y is up, units are metres. At the view's
 * 80 degree field of view the frame at z = -1.1 is ~0.92 m from centre to top, so the dashboard fills
 * roughly the bottom quarter and the road stays clear.
 * Reason: the pillars sit wide (x ~1.25 at the dash) so a landscape phone sees the frame at its edges while a
 * portrait phone, whose frame is only ~0.4 m wide at that depth, simply does not see them. */
import * as T from 'three';

/** Readout text, kept pure so it can be tested without a canvas. */
export function interiorReadout(sim) {
  const speed = Number.isFinite(sim?.speed) ? Math.round(Math.abs(sim.speed) * 3.6) : 0;
  const pct = value => Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value * 100))) : 0;
  return {speed: String(speed), boost: pct(sim?.energy), hull: pct(sim?.hull)};
}

/** Places a box of `thickness` running from `a` to `b` (both camera-space points). */
function strut(material, a, b, thickness) {
  const from = new T.Vector3(...a), to = new T.Vector3(...b);
  const mesh = new T.Mesh(new T.BoxGeometry(thickness, thickness, from.distanceTo(to)), material);
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.lookAt(to);
  return mesh;
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
  hood.position.set(0, -.47, -.9);
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
  screen.position.set(0, -.44, -.8);
  screen.rotation.x = -.5;

  const pillars = [-1, 1].map(side => strut(frame, [side * 1.25, -.52, -1.05], [side * .72, .8, -1.22], .07));
  const header = strut(frame, [-.74, .8, -1.22], [.74, .8, -1.22], .06);
  const headerGlow = strut(glow, [-.6, .765, -1.2], [.6, .765, -1.2], .008);
  const sills = [-1, 1].map(side => strut(frame, [side * 1.32, -.5, -1.05], [side * 1.4, -.36, .3], .09));

  group.add(dash, hood, lip, ...sideLights, screen, ...pillars, header, headerGlow, ...sills);
  group.traverse(object => {
    if (!object.isMesh) return;
    // Reason: the camera is the parent, so the interior is always in view; culling it would only cost the test.
    object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = false;
    object.renderOrder = 10;
  });
  camera.add(group);

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
      since += Number.isFinite(dt) ? dt : 0;
      if (since < .1) return;
      since = 0;
      draw(interiorReadout(sim));
    },
  };
}
