import * as T from 'three';
import {ITEMS} from './catalog.js';
/* CHARTVOLT PATCH (28 Sep 2026). Visuals for the new power-ups: a readable name tag above every
 * capsule, the oil-slick decal on the road, and cloak transparency. Pure presentation - nothing
 * here decides an outcome; the server does. */

const labelMaterials = new Map();

/** One texture and material per capsule KIND, shared by every capsule of that kind (29 textures became at most 13). */
function labelMaterial(kind) {
  if (labelMaterials.has(kind)) return labelMaterials.get(kind);
  const item = ITEMS[kind], hex = '#' + item.color.toString(16).padStart(6, '0');
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  // Reason: the capsule's own light beam is additive and runs straight through the tag, so without
  // an opaque dark pill the white name washes out to nothing - which is how the names went unseen.
  ctx.fillStyle = 'rgba(3,12,22,0.86)'; ctx.strokeStyle = hex; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(8, 16, 496, 96, 48); ctx.fill(); ctx.stroke();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillStyle = hex; ctx.font = 'bold 54px Arial'; ctx.fillText(item.icon, 70, 66);
  ctx.fillStyle = '#f2fbff'; ctx.font = 'bold 44px Arial'; ctx.fillText(item.name, 290, 66, 380);
  const map = new T.CanvasTexture(c); map.colorSpace = T.SRGBColorSpace;
  const material = new T.SpriteMaterial({map, transparent: true, depthWrite: false});
  labelMaterials.set(kind, material);
  return material;
}

/** The small name tag floating above a capsule. */
export function powerupLabel(kind) {
  const label = new T.Sprite(labelMaterial(kind));
  label.scale.set(3.4, 0.85, 1);
  label.position.y = 2.9;
  label.renderOrder = 5;
  label.userData.sharedMaterial = true;
  return label;
}

/** A flat slick lying on the road, sized to the server's catch radius. */
export function createSlickDecal(radius) {
  const color = ITEMS.slick.color, g = new T.Group();
  const pool = new T.Mesh(new T.CircleGeometry(radius, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({color, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false}));
  const rim = new T.Mesh(new T.RingGeometry(radius * 0.92, radius, 48).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({color, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false}));
  g.add(pool, rim); g.userData.pool = pool;
  return g;
}

/** Fades a ship to a faint shimmer while cloaked. Materials are cloned once so a shared material never fades another ship. */
export function setCloaked(mesh, on) {
  if (Boolean(mesh.userData.cloaked) === on) return;
  mesh.userData.cloaked = on;
  mesh.traverse(o => {
    if (!o.material || o.isSprite) return;
    if (!o.userData.cloakOwned) {
      o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
      o.userData.cloakOwned = true;
    }
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.userData.baseOpacity === undefined) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; }
      m.transparent = on || m.userData.baseTransparent;
      m.opacity = on ? m.userData.baseOpacity * 0.22 : m.userData.baseOpacity;
      m.needsUpdate = true;
    }
  });
}
