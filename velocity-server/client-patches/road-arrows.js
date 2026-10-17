import * as T from 'three';

// CHARTVOLT PATCH (28 Sep 2026): glowing chevrons painted on the road surface
// in the run-up to every real corner, pointing the way the road turns. The
// roadside boards in motorsport-kit.js sit outside the barriers and are easy
// to miss at speed; these are on the line the player is already looking at.
// Positive curvature is a right-hand turn, the same reading motorsport-kit.js
// and race-assist.js use. Two instanced meshes, so the cost is two draw calls.
const TURN = 0.0042, STEP = 16, LOOKAHEAD = 34, LIFT = 0.07;

function chevronTexture(color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.strokeStyle = color; x.lineWidth = 34; x.lineCap = 'round'; x.lineJoin = 'round';
  x.shadowColor = color; x.shadowBlur = 18;
  for (const cx of [130, 256, 382]) {
    x.beginPath(); x.moveTo(cx - 44, 48); x.lineTo(cx + 40, 128); x.lineTo(cx - 44, 208); x.stroke();
  }
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace; map.anisotropy = 8;
  return map;
}

export function buildRoadArrows(view) {
  const { track } = view;
  const spots = [];
  for (let d = 0; d < track.length; d += STEP) {
    const k = track.curvature(d + LOOKAHEAD);
    // Reason: only the approach, not the whole bend, so the arrows read as a
    // warning rather than as paint covering every corner end to end.
    if (Math.abs(k) > TURN && Math.abs(track.curvature(d)) < Math.abs(k)) spots.push({ d, right: k > 0 });
  }
  if (!spots.length) return;
  const group = new T.Group(); group.name = 'Road_turn_arrows'; view.scene.add(group);
  const geometry = new T.PlaneGeometry(12, 7.5);
  const make = (right) => {
    const list = spots.filter((s) => s.right === right);
    if (!list.length) return;
    const material = new T.MeshBasicMaterial({
      map: chevronTexture('#ffd27a'), color: new T.Color(0xffc56b).multiplyScalar(2.2),
      transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    material.userData.noShadow = true;
    const mesh = new T.InstancedMesh(geometry, material, list.length);
    mesh.frustumCulled = false; mesh.renderOrder = 2;
    const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(1, 1, 1);
    list.forEach((spot, i) => {
      const f = track.frame(spot.d);
      const side = right ? f.right.clone() : f.right.clone().negate();
      const normal = side.clone().cross(f.forward).normalize();
      // Reason: build a right-handed basis so the chevron is never mirrored;
      // the texture's +X is the direction of the turn.
      q.setFromRotationMatrix(new T.Matrix4().makeBasis(side, f.forward, normal));
      const p = f.p.clone().addScaledVector(f.up, LIFT);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  };
  make(true); make(false);
  view.environmentStats = view.environmentStats || {};
  view.environmentStats.roadArrows = spots.length;
}
