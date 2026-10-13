import {clearOfGrandstands} from './grandstand-layout.js';
import {facadeMaps} from './facade-materials.js';
import {BUILDING_STYLES,buildingStyleIndex,facadeOffset} from './building-styles.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {rng} from './tracks.js';
const UP=new T.Vector3(0,1,0),GROUND=-105;
function archSign(){const c=document.createElement('canvas');c.width=1024;c.height=128;const x=c.getContext('2d');x.fillStyle='#061929';x.fillRect(0,0,1024,128);x.strokeStyle='#78eaff';x.lineWidth=4;x.strokeRect(4,4,1016,120);x.fillStyle='#c9faff';x.shadowColor='#2cbfff';x.shadowBlur=15;x.textAlign='center';x.font='italic 700 62px Arial';x.fillText('ϟ VOLT VELOCITY',512,84);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:t,toneMapped:false});}

// All architecture is world upright. Road banking is used only for bridge fixtures.
export class Parts{
 constructor(scene){this.scene=scene;this.detailCells=[];this.groups=new Map();this.box=new T.BoxGeometry(1,1,1);/* CHARTVOLT PATCH (13 Oct 2026, owner: "on mobile ... need optimal play ... light"): every pillar, pier and rail post in the city is an instance of this cylinder, so its segment count multiplies across tens of thousands of instances. 16 sides is indistinguishable from 40 at phone size and more than halves each one. */this.cylinder=new T.CylinderGeometry(.5,.5,1,matchMedia('(pointer:coarse)').matches?16:40);this.soft=new RoundedBoxGeometry(1,1,1,1,.06);}
 add(material,pos,size,quaternion=new T.Quaternion(),rounded=false){const detail=material.userData.detail&&Math.min(...size)<.4;const geo=rounded==='cylinder'?this.cylinder:rounded?this.soft:this.box,key=material.uuid+rounded+detail+':'+Math.floor(pos.x/560)+':'+Math.floor(pos.z/560);if(!this.groups.has(key))this.groups.set(key,{geo,material,detail,matrices:[],sizes:[],facades:[]});const group=this.groups.get(key);group.sizes.push(...size);group.facades.push(...facadeOffset(pos.x,pos.z));group.matrices.push(new T.Matrix4().compose(pos,quaternion,new T.Vector3(...size)));}
 finish(){let count=0;for(const {geo,material,detail,matrices,sizes,facades}of this.groups.values()){const geometry=geo.clone();geometry.setAttribute('instanceDimensions',new T.InstancedBufferAttribute(new Float32Array(sizes),3));geometry.setAttribute('instanceFacade',new T.InstancedBufferAttribute(new Float32Array(facades),2));const mesh=new T.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();if(detail){mesh.userData.center=mesh.boundingSphere.center.clone();mesh.userData.detailRadius=mesh.boundingSphere.radius;this.detailCells.push(mesh);}mesh.castShadow=!material.userData.noShadow;mesh.receiveShadow=true;this.scene.add(mesh);count+=matrices.length;}this.box.dispose();this.soft.dispose();this.cylinder.dispose();return count;}
}
export function glassMaterial(color,night,fm,clock,styleIndex=0){
 const maps=fm.styles[styleIndex],style=maps.style;
 const mat=new T.MeshPhysicalMaterial({color:0xffffff,map:maps.albedo,normalMap:maps.normal,normalScale:new T.Vector2(.32,.32),roughnessMap:maps.roughness,roughness:.82,metalness:style.metalness,clearcoat:.38,clearcoatRoughness:.28,specularIntensity:.6,envMapIntensity:1.05,emissive:0xffffff,emissiveMap:maps.emission,emissiveIntensity:night?.9:.14});
 // Continuous world-scaled UVs preserve hardware derivatives and mip filtering.
 // The old fragment hash magnified interpolation roundoff into changing rooms.
 mat.onBeforeCompile=s=>{s.uniforms.facadePitch={value:new T.Vector2(...style.windowPitch)};s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 instanceDimensions;attribute vec2 instanceFacade;uniform vec2 facadePitch;').replace('#include <uv_vertex>',`#include <uv_vertex>
 vec2 faceSize=vec2(mix(instanceDimensions.x,instanceDimensions.z,step(.5,abs(normal.x))),mix(instanceDimensions.y,instanceDimensions.z,step(.5,abs(normal.y))));
 vec2 stableFacadeUv=uv*faceSize/(facadePitch*8.0)+instanceFacade;
 vMapUv=stableFacadeUv;vNormalMapUv=stableFacadeUv;vRoughnessMapUv=stableFacadeUv;vEmissiveMapUv=stableFacadeUv;`);};
 mat.customProgramCacheKey=()=> 'facade17-filtered';mat.userData.facadeStyle=style.id;return mat;
}

function buildingPalette(fm,night,clock){return BUILDING_STYLES.map((style,i)=>{
 const facade=glassMaterial(0xffffff,night,fm,clock,i),frame=new T.MeshStandardMaterial({color:style.trim,map:fm.metal,normalMap:fm.normal,normalScale:new T.Vector2(.25,.25),roughnessMap:fm.rough,roughness:.65,metalness:style.metalness+.2});
 const accent=new T.MeshBasicMaterial({color:new T.Color(style.accent).multiplyScalar(night?3.8:2.5)}),warm=new T.MeshBasicMaterial({color:new T.Color(style.warm).multiplyScalar(night?2.5:1.7)});accent.userData.noShadow=warm.userData.noShadow=true;
 return {style,facade,frame,accent,warm};
});}
function signTexture(){const c=document.createElement('canvas');c.width=512;c.height=1024;const x=c.getContext('2d'),bg=x.createLinearGradient(0,0,512,1024);bg.addColorStop(0,'#071c37');bg.addColorStop(.5,'#0a4a73');bg.addColorStop(1,'#041225');x.fillStyle=bg;x.fillRect(0,0,512,1024);for(let i=0;i<1024;i+=8){x.fillStyle='#4bbfff18';x.fillRect(0,i,512,1);}x.strokeStyle='#47dcff';x.lineWidth=5;x.strokeRect(16,16,480,992);x.shadowColor='#30cfff';x.shadowBlur=26;x.fillStyle='#92f6ff';x.beginPath();for(const [i,p]of [[0,[286,130]],[1,[160,438]],[2,[264,410]],[3,[211,646]],[4,[370,330]],[5,[263,355]]])i?x.lineTo(...p):x.moveTo(...p);x.closePath();x.fill();x.shadowBlur=0;x.textAlign='center';x.font='700 46px Arial';x.fillText('VOLT',256,748);x.fillText('VELOCITY',256,807);x.font='18px Arial';x.fillStyle='#9fd6e4';x.fillText('POWERED BY CHARTVOLT',256,862);x.fillStyle='#45dcff';x.fillRect(136,911,240,4);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
export function buildArchitecture(view,texture){
 const {track,scene}=view,p=view.environment,random=rng(track.content.seed^0x6e6f7274),night=p.sky==='night',parts=new Parts(scene),road=Array.from({length:600},(_,i)=>track.frame(track.length*i/600).p.clone());
 const concrete=new T.MeshStandardMaterial({color:night?0x66758a:0xa4afba,map:texture('concrete'),normalMap:texture('concreteNormal'),roughnessMap:texture('concreteRough'),roughness:.9,metalness:.12});concrete.normalScale.set(.45,.45);
 const silverMetal=new T.MeshStandardMaterial({color:0xabb5c0,metalness:.8,roughness:.26});
 const metal=new T.MeshStandardMaterial({color:0x465b6f,metalness:.8,roughness:.29}),dark=new T.MeshStandardMaterial({color:0x172d3e,metalness:.7,roughness:.3});
 metal.userData.detail=true;metal.userData.noShadow=true;dark.userData.noShadow=true;
 const fm=facadeMaps();view.facadeMaps=fm;view.cityClock={value:0};for(const mat of [metal,silverMetal,dark]){mat.map=fm.metal;mat.roughnessMap=fm.rough;mat.normalMap=fm.normal;mat.normalScale.set(.45,.45);mat.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\n#ifdef USE_INSTANCING\nattribute vec3 instanceDimensions;\n#endif').replace('#include <uv_vertex>',`#include <uv_vertex>
#ifdef USE_INSTANCING
vec2 scaleUV=vec2(mix(instanceDimensions.x,instanceDimensions.z,step(.5,abs(normal.x))),mix(instanceDimensions.y,instanceDimensions.z,step(.5,abs(normal.y))))/4.;vMapUv=uv*scaleUV;vNormalMapUv=uv*scaleUV;vRoughnessMapUv=uv*scaleUV;
#endif`);};}
 const palette=view.buildingPalette=buildingPalette(fm,night,view.cityClock);
 const light=new T.MeshBasicMaterial({color:new T.Color(0x65deff).multiplyScalar(2)}),warm=new T.MeshBasicMaterial({color:new T.Color(0xffc084).multiplyScalar(1.5)});light.userData.noShadow=warm.userData.noShadow=true;
 const billboards=new T.MeshBasicMaterial({map:signTexture(),toneMapped:false});billboards.userData.noShadow=true;
 const vegetation=new T.MeshStandardMaterial({color:0x29482f,roughness:.9});const gantrySign=archSign();
 const placements=[];let foundations=0,piers=0;
 const beam=(a,b,width,depth,mat=concrete)=>{const delta=b.clone().sub(a);parts.add(mat,a.clone().add(b).multiplyScalar(.5),[width,delta.length(),depth],new T.Quaternion().setFromUnitVectors(UP,delta.normalize()),false);};
 // Continuous structural deck with vertical side walls, rather than two floating sheets.
 for(const side of [-1,1]){
  const vertices=[],uv=[],indices=[],steps=1200;
  for(let i=0;i<=steps;i++){const f=track.frame(track.length*i/steps);for(const y of [-2.9,.2]){const a=f.p.clone().addScaledVector(f.right,side*21).addScaledVector(f.up,y);vertices.push(...a);uv.push(i/steps*track.length/8,y);}if(i<steps){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const mat=metal.clone();mat.side=T.DoubleSide;const m=new T.Mesh(g,mat);m.castShadow=m.receiveShadow=true;scene.add(m);
 }
 for(let d=0;d<track.length;d+=65){const f=track.frame(d),top=f.p.clone().addScaledVector(f.up,-3.2),base=new T.Vector3(top.x,GROUND,top.z),join=new T.Vector3(top.x,top.y-18,top.z),q=new T.Quaternion().setFromAxisAngle(UP,Math.atan2(f.forward.x,f.forward.z));
  parts.add(concrete,base.clone().add(new T.Vector3(0,2,0)),[18,4,18],q,true);beam(base.clone().add(new T.Vector3(0,3,0)),join,5.2,7);for(const sign of [-1,1]){const cap=top.clone().addScaledVector(f.right,sign*12);beam(join,cap,3.5,6);}
  parts.add(metal,top,[31,1.6,8],new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f.right,f.up,f.forward.clone().negate())));piers++;
 }
 // Real solid barrier sections and inset light lenses.
 for(let d=0;d<track.length;d+=6){const f=track.frame(d),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f.right,f.up,f.forward.clone().negate()));for(const sign of [-1,1]){const at=(x,y)=>f.p.clone().addScaledVector(f.right,sign*x*1.25).addScaledVector(f.up,y);parts.add(metal,at(16.7,.9),[.85,1.8,6.12],q,true);parts.add(dark,at(16.18,.8),[.12,.8,5.6],q);parts.add(light,at(16.09,1.18),[.08,.16,4.4],q);parts.add(warm,at(16.7,1.83),[.42,.06,2.2],q);}}
 function tower(cx,cz,w,depth,height,angle,index){const family=palette[buildingStyleIndex(cx,cz,index)],glazing=family.facade,metal=family.frame,light=family.accent,warm=family.warm;const q=new T.Quaternion().setFromAxisAngle(UP,angle),origin=new T.Vector3(cx,GROUND,cz),at=(x,y,z)=>new T.Vector3(x,y,z).applyQuaternion(q).add(origin),put=(mat,x,y,z,s,soft=false)=>parts.add(mat,at(x,y,z),s,q,soft);
  put(concrete,0,3,0,[w+15,6,depth+15],true);put(dark,0,10,0,[w+7,8,depth+7],true);put(concrete,0,32,0,[w+9,36,depth+9],true);put(silverMetal,0,51,0,[w+11,2,depth+11],true);
  // Recessed lobby glazing, shaded colonnade and planted podium roof.
  for(const sign of [-1,1]){put(glazing,0,40,sign*(depth/2+4.55),[w-4,15,.2]);put(metal,0,48,sign*(depth/2+6),[w+7,.6,4]);for(let x=-w/2+2;x<w/2;x+=7)put(concrete,x,39,sign*(depth/2+5.2),[.7,20,.8]);}
  for(let x=-w/2+2;x<w/2;x+=8){put(dark,x,53,depth/2+2,[5,1.5,3]);put(vegetation,x,54,depth/2+2,[4.4,2,2.5],true);}
 put(warm,0,14.1,0,[w+7.1,.2,depth+7.1]);foundations++;
  // Multiple setbacks give each skyline silhouette a designed crown.
  const h=height-52,round=index%6===1,twin=index%6===3;let bottom=52;
  for(let tier=0;tier<3;tier++){const ratios=index%4===0?[.42,.42,.16]:index%4===2?[.77,.16,.07]:[.63,.24,.13];const th=Math.max(9.6,Math.floor(h*ratios[tier]/4.8)*4.8),tw=w*(1-tier*(index%3===0?.25:.13)),td=depth*(1-tier*.14);
   if(twin){for(const sign of [-1,1])put(glazing,sign*tw*.31,bottom+th/2,0,[tw*.38,th,td],true);put(metal,0,bottom+th*.62,0,[tw,3,td*.7],true);}else put(glazing,0,bottom+th/2,0,[tw,th,td],round?'cylinder':true);
   if(round){for(let n=0;n<10;n++){const a=n*Math.PI/5;put(metal,Math.cos(a)*tw/2,bottom+th/2,Math.sin(a)*td/2,[.45,th,.45],true);}}else for(const x of [-tw/2,tw/2])for(const z of [-td/2,td/2]){put(metal,x,bottom+th/2,z,[1.25,th+.5,1.25],true);if(index%3!==1)put(light,x+(x>0?.65:-.65),bottom+th/2,z,[.65,th*.94,.75]);}
   for(let level=bottom;level<bottom+th;level+=4.8){put(metal,0,level,0,[tw+.8,.32,td+.8],round?'cylinder':false);}
   if(!round)for(let x=-tw/2+2.8;x<tw/2;x+=2.8)for(const z of [-td/2-.13,td/2+.13])put(metal,x,bottom+th/2,z,[.25,th,.2]);
   put(metal,0,bottom+th,0,[tw+2,1.5,td+2],round?'cylinder':true);
   if(index%3!==1&&tier<2){const floor=bottom+th;put(dark,0,floor-1,0,[tw+10,1.8,td+10],true);put(silverMetal,0,floor,0,[tw+10,.6,td+10],true);put(warm,0,floor-.35,0,[tw+10.2,.42,td+10.2]);
    for(const sign of [-1,1]){put(metal,0,floor+2,sign*(td/2+4),[tw+8,.25,.2]);for(let x=-tw/2;x<=tw/2;x+=4){put(metal,x,floor+1,sign*(td/2+4),[.12,2,.12]);put(dark,x,floor+.4,sign*(td/2+2),[2,.8,1.7],true);put(vegetation,x,floor+1.05,sign*(td/2+2),[1.8,1.1,1.5],true);}}
   }bottom+=th;
  }
  height=bottom;
  if(index%4===0){for(const sign of [-1,1])beam(at(sign*w*.52,15,-depth*.51),at(sign*w*.23,height*.87,-depth*.51),1.8,1.8,silverMetal);}
  put(dark,0,height+2,0,[w*.35,4,depth*.3],true);put(metal,0,height+10,0,[.65,18,.65]);put(warm,0,height+19,0,[.9,.9,.9],true);
  for(let x=-1;x<=1;x++)put(metal,x*w*.18,height+1,depth*.16,[w*.11,2.5,depth*.17],true);
  if(index%3===0){const bh=Math.min(36,height*.2),y=height*.48;for(const sign of [-1,1]){put(dark,0,y,sign*(depth/2+1.1),[w*.67+2,bh+2,2],true);put(billboards,0,y,sign*(depth/2+2.16),[w*.67,bh,.08]);}}
  placements.push({x:cx,z:cz,radius:Math.hypot(w,depth)*.5+9,width:w,depth,bottom:GROUND,top:GROUND+height+19,worldUp:[0,1,0],facadeStyle:family.style.id});
 }
 const natural=['jungle','volcano','alpine','coast','desert','canyon'].includes(p.type);const count=natural?0:night?56:62;
 for(let i=0;i<count;i++){const d=(i+random()*.5)*track.length/count,f=track.frame(d),side=i%2?1:-1,offset=70+random()*140,w=30+random()*32,depth=28+random()*29;
  const lateral=new T.Vector3(f.right.x,0,f.right.z).normalize(),center=f.p.clone().addScaledVector(lateral,side*offset),radius=Math.hypot(w,depth)*.5+28;
  if(!clearOfGrandstands(view.grandstands,center.x,center.z,Math.hypot(w,depth)*.5+10)||road.some(v=>Math.hypot(v.x-center.x,v.z-center.z)<radius)||placements.some(v=>Math.hypot(v.x-center.x,v.z-center.z)<radius+35))continue;
  // Buildings start at the same terrain elevation, never at a banked track offset.
  const height=135+random()*150+(i%13===0?65:0);tower(center.x,center.z,w,depth,height,Math.atan2(f.forward.x,f.forward.z)+(side<0?Math.PI:0),i);
 }
 // A second, lower skyline supplies depth without large repeating foreground blocks.
 for(let i=0;i<(natural?0:36);i++){const a=random()*Math.PI*2,r=190+random()*1050,cx=Math.cos(a)*r,cz=Math.sin(a)*r,w=22+random()*25;if(road.some(v=>Math.hypot(v.x-cx,v.z-cz)<w+55)||placements.some(v=>Math.hypot(v.x-cx,v.z-cz)<w+38))continue;tower(cx,cz,w,w*.82,65+random()*190,a,i+130);}
 // Eight engineered segmented checkpoint arches, open at road level.
 for(let i=0;i<8;i++){const f=track.frame(80+i*track.length/8),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f.right,f.up,f.forward.clone().negate()));const local=(x,y)=>f.p.clone().addScaledVector(f.right,x).addScaledVector(f.up,y);
  const sign=new T.Mesh(new T.PlaneGeometry(13,1.65),gantrySign);sign.position.copy(local(0,18.3)).addScaledVector(f.forward,-1.9);sign.quaternion.copy(q);scene.add(sign);
  for(let j=0;j<22;j++){const a=Math.PI*j/22,b=Math.PI*(j+1)/22,mid=(a+b)/2,aa=local(Math.cos(a)*18.8,Math.sin(a)*18.8),bb=local(Math.cos(b)*18.8,Math.sin(b)*18.8);beam(aa,bb,2.4,3.4,metal);if(j%3!==0){const qq=q.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),mid-Math.PI/2));parts.add(j%2?light:warm,local(Math.cos(mid)*18,Math.sin(mid)*18),[.4,2.1,2.7],qq,true);}}
 }
 // Connected service skyways attach to actual towers below the race deck.
 let skyways=0;
 for(let i=1;i<placements.length&&skyways<30;i++){const a=placements[i-1],b=placements[i],distance=Math.hypot(a.x-b.x,a.z-b.z);if(distance<65||distance>235||Math.min(a.top,b.top)<55)continue;
 const start=new T.Vector3(a.x,-1,a.z),end=new T.Vector3(b.x,-1,b.z),delta=end.clone().sub(start),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),delta.clone().normalize()),middle=start.clone().add(end).multiplyScalar(.5),side=new T.Vector3(delta.z,0,-delta.x).normalize();parts.add(dark,middle,[8,2.5,distance],q,true);
 for(const sign of [-1,1]){parts.add(metal,middle.clone().addScaledVector(side,sign*3.9).add(new T.Vector3(0,1.7,0)),[.35,1.1,distance],q);parts.add(light,middle.clone().addScaledVector(side,sign*3.95).add(new T.Vector3(0,2.28,0)),[.15,.1,distance],q);}
 for(const pos of [start,end])parts.add(metal,pos,[13,4,13],undefined,true);skyways++;
 }
 const instances=parts.finish();view.detailCells=parts.detailCells;view.environmentStats={spatialCulling:'560m cells, distance-capped facade detail',theme:p.type,architecture:'setback, twin, oval and exoskeleton towers with supported terrace decks',instances,batches:parts.groups.size,buildings:placements.length,foundations,piers,skyways,groundY:GROUND,grounded:placements.every(v=>v.bottom===GROUND),upright:true,materials:'2K PBR + HDR lighting',placements};
}
