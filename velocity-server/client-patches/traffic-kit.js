import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PHONE} from './phone-budget.js';
// CHARTVOLT PATCH (14 Oct 2026, owner: still heavy on mobiles): a taxi seen from a moving phone gets
// about a third of the triangles and no clearcoat layer, which is a second specular pass per pixel.
const SEG=PHONE?.4:1,seg=n=>Math.max(6,Math.round(n*SEG)),COAT=PHONE?0:1;
// Shared five-material hover-taxi kit. Rounded volume, recessed glazing,
// underslung lift fans, intake channels and navigation lamps read from below.
export function trafficKit(){
 const mats=[new T.MeshPhysicalMaterial({color:0xa2b9c8,metalness:.65,roughness:.3,clearcoat:.65*COAT}),new T.MeshStandardMaterial({color:0x132431,metalness:.65,roughness:.42}),new T.MeshPhysicalMaterial({color:0x154a61,metalness:.7,roughness:.15,clearcoat:COAT}),new T.MeshBasicMaterial({color:new T.Color(0x81e9ff).multiplyScalar(1.6)}),new T.MeshBasicMaterial({color:0xff7558})],bins=mats.map(()=>[]);
 const add=(geo,m,p=[0,0,0],s=[1,1,1],rx=0)=>{geo.scale(...s);geo.rotateX(rx);geo.translate(...p);bins[m].push(geo);};
 const box=(w,h,d,m,p)=>add(Math.min(w,h,d)<.18?new T.BoxGeometry(w,h,d):new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.2),m,p);
 const body=new T.SphereGeometry(1,seg(48),seg(24));body.scale(1.55,.62,3);const pos=body.attributes.position;for(let i=0;i<pos.count;i++)pos.setX(i,pos.getX(i)*(1+pos.getZ(i)*.045));body.computeVertexNormals();add(body,0);
 add(new T.SphereGeometry(1,seg(40),seg(24)),2,[0,.53,-.42],[1.17,.51,1.78]);
 add(new T.SphereGeometry(1,seg(32),seg(16)),1,[0,-.31,.3],[1.35,.34,2.42]);
 box(.12,.12,3.1,0,[0,1,-.25]);box(2.5,.15,1,0,[0,.35,2.14]);
 for(const x of [-1.36,1.36]){add(new T.CylinderGeometry(.28,.43,2.7,seg(32)),0,[x,-.25,.82],[1,1,1],Math.PI/2);add(new T.TorusGeometry(.32,.07,seg(10),seg(32)),3,[x,-.25,2.21]);box(.53,.16,.12,3,[x,.03,-2]);box(.6,.12,.1,4,[x,.08,2.1]);
 for(let i=0;i<5;i++)box(.17,.045,.35,1,[x,.36,.65+i*.2]);
 const fanx=x*.64;add(new T.TorusGeometry(.43,.09,seg(12),seg(32)),0,[fanx,-.64,.26],[1,1,1],Math.PI/2);add(new T.TorusGeometry(.28,.038,seg(8),seg(32)),3,[fanx,-.74,.26],[1,1,1],Math.PI/2);for(let j=0;j<6;j++){const a=j*Math.PI/3,g=new T.BoxGeometry(.06,.045,.55);g.rotateY(a);g.translate(fanx,-.7,.26);bins[1].push(g);}
 box(.12,.065,1.8,3,[x*.77,-.57,-.8]);
 }
 for(let j=0;j<5;j++)box(1.15,.06,.12,1,[0,-.65,1+j*.22]);
 return bins.map((geos,i)=>{const flat=geos.map(g=>g.index?g.toNonIndexed():g),geometry=mergeGeometries(flat,false);new Set([...geos,...flat]).forEach(g=>g.dispose());return {geo:geometry,mat:mats[i],matrix:new T.Matrix4()};});
}
