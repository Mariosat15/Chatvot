// CHARTVOLT PATCH (14 Oct 2026, owner: still heavy on mobiles): a phone draws the crowd only within 350m.
import {PHONE,PHONE_BUDGET} from './phone-budget.js';
import * as T from 'three';
import atlasUrl from '../assets/crowd/seated-spectators_cv.webp';
import atlas from '../assets/crowd/manifest.json';
import {rng} from './tracks.js';
import {STAND_ROWS,STAND_COLUMNS,rowHeight,rowSetback,seatAcross} from './grandstand-layout.js';

// Detailed crowd impostors are appropriate at the grandstands' racing-camera
// distance. One native RGBA atlas and one instanced draw per stand; no DOM fans,
// flat opaque panels, frame-random identities, or hundreds of material objects.
function animateMaterial(material,clock,yaw,depth=false){
 material.onBeforeCompile=shader=>{
  shader.uniforms.crowdTime=clock;shader.uniforms.crowdYaw=yaw;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute vec4 crowdAtlas;
attribute vec4 crowdMotion;
uniform float crowdTime;
uniform float crowdYaw;
mat2 crowdTurn(){float a=crowdYaw;return mat2(cos(a),-sin(a),sin(a),cos(a));}`)
   .replace('#include <uv_vertex>',`#include <uv_vertex>
#ifdef USE_MAP
vMapUv=crowdAtlas.xy+vMapUv*crowdAtlas.zw;
#endif
#ifdef USE_EMISSIVEMAP
vEmissiveMapUv=crowdAtlas.xy+vEmissiveMapUv*crowdAtlas.zw;
#endif`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
float upperBody=smoothstep(.30,.85,uv.y);
transformed.x+=sin(crowdTime*crowdMotion.y+crowdMotion.x)*crowdMotion.z*upperBody;
transformed.y+=sin(crowdTime*crowdMotion.y*.7+crowdMotion.x)*crowdMotion.w*upperBody;
transformed.xz=crowdTurn()*transformed.xz;`);
  if(!depth)shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal.xz=crowdTurn()*objectNormal.xz;');
 };
 material.customProgramCacheKey=()=>`chartvolt-spectators-19-${depth?'depth':'lit'}`;
}

export function buildSpectators(view,stands){
 const stats={spectators:0,seats:stands.length*STAND_ROWS*STAND_COLUMNS,variants:12,textureReady:false,textureResolution:atlas.nativeResolution,rendering:'lit, alpha-tested instanced crowd impostors',stands:[],visibleSpectators:0};
 view.environmentStats.crowd=stats;view.crowdClock={value:0};view.crowdBatches=[];
 const texture=new T.TextureLoader().load(atlasUrl,loaded=>{if(view.disposed){loaded.dispose();return;}stats.textureReady=true;stats.textureResolution=[loaded.image.width,loaded.image.height];},undefined,error=>{stats.textureError=String(error?.message||'Spectator artwork failed to load');});
 texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=true;texture.anisotropy=Math.min(8,view.renderer.capabilities.getMaxAnisotropy());texture.userData.preserveResolution=true;
 const [width,height]=atlas.nativeResolution,matrix=new T.Matrix4(),scale=new T.Vector3(),position=new T.Vector3(),rotation=new T.Quaternion(),up=new T.Vector3(0,1,0);
 for(const stand of stands){
  const random=rng((view.track.content.seed^0x5f41b123^Math.imul(stand.id+1,7919))>>>0),fans=[];
  for(let row=0;row<STAND_ROWS;row++)for(let col=0;col<STAND_COLUMNS;col++){
   if(random()<.085)continue; // A few genuinely empty chairs; aisles stay clear.
   const variant=(row*7+col*5+Math.floor(random()*4))%12;
   fans.push({row,col,variant,height:1.49+random()*.13,phase:random()*Math.PI*2,rate:.9+random()*1.3,sway:.006+random()*.009,bob:.002+random()*.004,yaw:(random()-.5)*.12,brightness:.88+random()*.12});
  }
  const geometry=new T.PlaneGeometry(1,1,3,5);geometry.translate(0,.5,0);
  const rects=new Float32Array(fans.length*4),motion=new Float32Array(fans.length*4),yaw={value:0};
  const material=new T.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.2,roughness:1,metalness:0,alphaTest:.42,transparent:false,depthWrite:true,side:T.FrontSide});
  animateMaterial(material,view.crowdClock,yaw);
  const mesh=new T.InstancedMesh(geometry,material,fans.length);mesh.name=`Seated_spectators_${stand.id}`;mesh.position.copy(stand.origin);mesh.quaternion.copy(stand.quaternion);mesh.receiveShadow=true;mesh.castShadow=true;mesh.visible=false;
  const depth=new T.MeshDepthMaterial({map:texture,alphaTest:.42,depthPacking:T.RGBADepthPacking,side:T.DoubleSide});animateMaterial(depth,view.crowdClock,yaw,true);mesh.customDepthMaterial=depth;
  fans.forEach((fan,i)=>{
   const [x0,y0,x1,y1]=atlas.people[fan.variant],ratio=(x1-x0)/(y1-y0);
   rects.set([x0/width,1-y1/height,(x1-x0)/width,(y1-y0)/height],i*4);
   motion.set([fan.phase,fan.rate,fan.sway,fan.bob],i*4);
   position.set(seatAcross(fan.col),rowHeight(fan.row)+.025,rowSetback(fan.row)+.32);
   rotation.setFromAxisAngle(up,fan.yaw);scale.set(fan.height*ratio,fan.height,1);
   mesh.setMatrixAt(i,matrix.compose(position,rotation,scale));
   mesh.setColorAt(i,new T.Color().setRGB(fan.brightness,fan.brightness,Math.min(1,fan.brightness+.02)));
  });
  geometry.setAttribute('crowdAtlas',new T.InstancedBufferAttribute(rects,4));geometry.setAttribute('crowdMotion',new T.InstancedBufferAttribute(motion,4));mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.2;
  mesh.userData.crowd={stand,count:fans.length,yaw};view.crowdBatches.push(mesh);view.scene.add(mesh);
  stats.spectators+=fans.length;stats.stands.push({id:stand.id,distance:stand.distance,people:fans.length,seats:STAND_ROWS*STAND_COLUMNS,position:stand.origin.toArray(),front:stand.front.toArray(),rowsRiseAwayFromTrack:true});
 }
}

export function updateSpectators(view){
 if(!view.crowdClock)return;
 view.crowdClock.value=view.reduced?0:view.visualTime;
 const low=view.graphicsQuality?.textures==='low';let visible=0;
 for(const mesh of view.crowdBatches){
  const {stand,count,yaw}=mesh.userData.crowd,toRacer=view.ship.position.clone().sub(stand.origin),distance=toRacer.length();
  mesh.visible=view.environmentStats.crowd.textureReady&&distance<(PHONE?PHONE_BUDGET.spectatorRange:low?500:900);
  mesh.castShadow=!low&&distance<200;
  // Small head/body turns toward passing ships stay within 17 degrees of the
  // road-facing seating direction. Spectators never turn their backs to it.
  yaw.value=T.MathUtils.clamp(Math.atan2(toRacer.dot(stand.right),toRacer.dot(stand.front)),-.30,.30);
  if(mesh.visible)visible+=count;
 }
 view.environmentStats.crowd.visibleSpectators=visible;
}
