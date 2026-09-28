import understoryURL from '../assets/biome-polish/understory.webp';
import {grandstandLayouts} from './grandstand-layout.js';
import {buildMotorsportKit} from './motorsport-kit.js';
import {buildRoadArrows} from './road-arrows.js';
import {buildTrackLife} from './track-life.js';
import {loadScannedCliffs} from './scanned-cliffs.js';
import limestoneRough from '../assets/landscape/rock_3_rough_2k.webp';
import limestoneNormal from '../assets/landscape/rock_3_nor_gl_2k.webp';
import limestone from '../assets/landscape/rock_3_diff_2k.webp';
import sandstoneRough from '../assets/landscape/rock_face_rough_2k.webp';
import sandstoneNormal from '../assets/landscape/rock_face_nor_gl_2k.webp';
import sandstone from '../assets/landscape/rock_face_diff_2k.webp';
import {buildReferenceWorld} from './reference-world.js';
import {buildImmersiveWorld} from './immersive-world.js';
import {buildEnvironmentDepth} from './environment-depth.js';
import {createHDSky} from './hd-sky.js';
import {buildSkyDetail} from './atmosphere-detail.js';
import {buildEcosystem} from './ecosystem.js';
import {buildVolcanicFX} from './volcanic-fx.js';
import {buildBiome} from './biomes.js';
import {buildLivingWorld} from './living-world.js';
import {buildHeroCity} from './hero-city.js';
import foliageURL from '../assets/art-direction/foliage.webp';
import * as T from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {buildHorizon} from './horizon.js';
import {buildCloudCity} from './cloud-city.js';
import {buildArchitecture} from './architecture.js';
import sunset8k from '../assets/environment/sky-sunset-8k.webp';
import day8k from '../assets/environment/sky-day-8k.webp';
import dawn from '../assets/environment/sky-dawn.webp';
import dusk from '../assets/environment/sky-dusk.webp';
import night from '../assets/environment/sky-night.webp';
import asphalt from '../assets/architecture/asphalt_02_diff_2k.webp';
import asphaltNormal from '../assets/architecture/asphalt_02_nor_gl_2k.webp';
import asphaltRough from '../assets/architecture/asphalt_02_rough_2k.webp';
import concrete from '../assets/architecture/concrete_wall_007_diff_2k.webp';
import concreteNormal from '../assets/architecture/concrete_wall_007_nor_gl_2k.webp';
import concreteRough from '../assets/architecture/concrete_wall_007_rough_2k.webp';
import hdr from '../assets/architecture/kloppenheim_06_puresky_1k.hdr';
import cloudURL from '../assets/art-direction/cloud-bank.webp';
import sunsetURL from '../assets/art-direction/qwantani_sunset_puresky_2k.hdr';
import rock from '../assets/environment/rock-diff.webp';
import rockNormal from '../assets/environment/rock-normal.webp';
const textures={};let environmentHDR,sunsetHDR;
export const ENVIRONMENTS={
 alpine:{sky:'dawn',fog:0x9bb7cd,road:0x7a99aa,land:0xbad2de,type:'alpine',label:'ALPINE ASCENT · GLACIER',sun:2.6},
 coast:{sky:'dawn',fog:0x9fcbd4,road:0x7aa4b2,land:0x438b83,type:'coast',label:'AZURE ARCHIPELAGO · OCEAN',sun:2.8},
 desert:{sky:'dusk',fog:0xc1a38b,road:0xb18d72,land:0xb39068,type:'desert',label:'DUNE SERPENT · DESERT',sun:2.6},
 jungle:{sky:'dawn',skyTint:0xd3f4cd,fog:0x738d7a,road:0x687d71,land:0x35552b,type:'jungle',label:'EMERALD CANOPY · JUNGLE',sun:2.3},
 volcano:{sky:'dusk',skyTint:0xfac5a5,fog:0x615058,road:0x65585a,land:0x42332b,type:'volcano',label:'CALDERA IGNITION · VOLCANO',sun:2.1},
 orbital:{sky:'night',skyTint:0xa6b8ff,fog:0x111a36,road:0x718898,land:0x718898,type:'port',label:'ORBITAL SPACEPORT',sun:1.9,planet:true},
 skyline:{sky:'dusk',skyTint:0xd4b7ed,fog:0x8c789c,road:0x799bac,land:0xaac0d0,type:'city',label:'CLOUD CITY · SUNSET',sun:2.4},
 asteroid:{sky:'night',skyTint:0xa9b6cc,fog:0x101b2d,road:0x849397,land:0x7a6b5f,type:'asteroids',label:'DEEP SPACE · ASTEROID BELT',sun:1.9,planet:true},
 reactor:{sky:'dusk',skyTint:0x9fae80,fog:0x4a5143,road:0x7e8970,land:0x85958b,type:'reactor',label:'REACTOR COMPLEX',sun:2.1,tunnel:true},
 solar:{sky:'dusk',skyTint:0xffd6a4,fog:0xb78063,road:0x9a8372,land:0xbd8757,type:'solar',label:'SOLAR ARRAY · GOLDEN HOUR',sun:3.1},
 frozen:{sky:'dawn',skyTint:0xe8e8ff,fog:0x96b6cf,road:0x819aab,land:0xbcdaf1,type:'ice',label:'ARCTIC CITY · WATERFRONT',sun:2.7},
 canyon:{sky:'dawn',skyTint:0xffd2ab,fog:0xb78b6a,road:0x908071,land:0xbb7250,type:'canyon',label:'RED ROCK · CANYON RUN',sun:2.9},
 foundry:{sky:'night',skyTint:0xb9a1e9,fog:0x201b36,road:0x91849e,land:0x887a9a,type:'foundry',label:'MIDNIGHT FOUNDRY',sun:1.9,tunnel:true},
 eclipse:{sky:'night',skyTint:0x929ff8,fog:0x141a32,road:0x6c7eaa,land:0x69738b,type:'eclipse',label:'LUNAR OBSERVATORY',sun:1.6,planet:true},
 grandprix:{sky:'dawn',skyTint:0xe6f8ff,fog:0x9dadbe,road:0x829caa,land:0xb0c9ce,type:'stadium',label:'CHAMPIONSHIP SKYWAY',sun:2.8},
 // CHARTVOLT PATCH (28 Sep 2026): the three appended circuits reuse existing scenery types, so
 // every builder already knows how to dress them; setupEnvironment reads this table by track id.
 aurora:{sky:'night',skyTint:0x9cffe0,fog:0x0f2433,road:0x7b98a8,land:0xa9d6e8,type:'ice',label:'AURORA HIGHWAY · POLAR NIGHT',sun:1.8,aurora:true},
 harbor:{sky:'night',skyTint:0xe0a6ff,fog:0x1a1430,road:0x6f7f9c,land:0x5f6f86,type:'city',label:'NEON HARBOUR · MIDNIGHT DOCKS',sun:1.7},
 nebula:{sky:'night',skyTint:0xd2a8ff,fog:0x170f2e,road:0x80879c,land:0x6e6078,type:'asteroids',label:'NEBULA DRIFT · DEEP SPACE',sun:1.7,planet:true}
};
export async function loadEnvironmentAssets(){
 const loader=new T.TextureLoader();await Promise.all([new HDRLoader().loadAsync(sunsetURL).then(t=>{const data=t.image.data;for(let i=0;i<data.length;i+=4){const rgb=[0,1,2].map(k=>T.DataUtils.fromHalfFloat(data[i+k])),peak=Math.max(...rgb),scale=peak>8?8/peak:1;for(let k=0;k<3;k++)data[i+k]=T.DataUtils.toHalfFloat(rgb[k]*scale);}t.needsUpdate=true;sunsetHDR=t;t.mapping=T.EquirectangularReflectionMapping;}),new HDRLoader().loadAsync(hdr).then(t=>{environmentHDR=t;}),...Object.entries({understory:understoryURL,foliage:foliageURL,cloud:cloudURL,rock,rockNormal,dawn,dusk,night,asphalt,asphaltNormal,asphaltRough,concrete,concreteNormal,concreteRough}).map(async([name,url])=>{const t=await loader.loadAsync(url);if(!/Normal|Rough/.test(name))t.colorSpace=T.SRGBColorSpace;textures[name]=t;})]);
}
let landscapePromise;
export async function ensureLandscapeAssets(trackId){if(!['jungle','coast','alpine','desert','canyon','solar','volcano'].includes(ENVIRONMENTS[trackId]?.type))return;
 if(!landscapePromise){const loader=new T.TextureLoader();landscapePromise=Promise.all([loadScannedCliffs(),...Object.entries({sandstone,sandstoneNormal,sandstoneRough,limestone,limestoneNormal,limestoneRough}).map(async([name,url])=>{const t=await loader.loadAsync(url);if(!/Normal|Rough/.test(name))t.colorSpace=T.SRGBColorSpace;textures[name]=t;})]).catch(e=>{landscapePromise=null;throw e;});}await landscapePromise;
}
export function materialTexture(name,repeat=1){const t=textures[name].clone();t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;t.needsUpdate=true;return t;}
export function setupEnvironment(view){
 const p=ENVIRONMENTS[view.track.definition.id],night=p.sky==='night';view.environment=p;view.scene.fog=new T.FogExp2(p.fog,night?.0007:.0006);
 const golden=['skyline','solar'].includes(view.track.definition.id);const sky=(golden?sunsetHDR:textures[p.sky]).clone();sky.mapping=T.EquirectangularReflectionMapping;sky.needsUpdate=true;view.scene.background=sky;view.scene.backgroundIntensity=night?.48:golden?.12:.84;view.scene.backgroundRotation.y=golden?-1.82:view.track.definition.startFraction*5;
 const pmrem=new T.PMREMGenerator(view.renderer),target=pmrem.fromEquirectangular(golden?sunsetHDR:environmentHDR);pmrem.dispose();view.environmentTarget=target;view.scene.environment=target.texture;view.scene.environmentIntensity=night?.6:golden?.5:.75;view.scene.environmentRotation.copy(view.scene.backgroundRotation);if(golden){view.scene.environmentRotation.y=-2.3;view.scene.fog.color.setHex(0x82788b);view.scene.fog.density=.00045;};
 view.scene.add(new T.HemisphereLight(night?0x779cca:0xc5ddff,0x393c48,night?.55:.55));
 const sun=new T.DirectionalLight(night?0x98bcff:0xffd5a3,night?2:2.8);sun.position.set(-400,500,-220);sun.castShadow=true;sun.shadow.mapSize.setScalar(matchMedia('(pointer:coarse)').matches?1024:2048);sun.shadow.camera.left=-125;sun.shadow.camera.right=125;sun.shadow.camera.top=125;sun.shadow.camera.bottom=-125;sun.shadow.camera.near=1;sun.shadow.camera.far=900;sun.shadow.bias=-.0003;sun.shadow.normalBias=.2;sun.shadow.radius=2;view.scene.add(sun,sun.target);view.sun=sun;view.sunOffset=new T.Vector3(...(golden?[-480,135,105]:[-240,380,-180]));
 // Reflection lighting is independent of the directly sampled visible sky.
 view.sky=createHDSky(sky,view.scene.backgroundRotation.y,night);
 view.sky.material.uniforms.intensity.value=view.scene.backgroundIntensity;
 view.scene.background=null;view.scene.add(view.sky);view.environmentTextures=[sky];
 const road=view.materials.road;road.color.setHex(0x1c2836);road.map=materialTexture('asphalt',6);road.normalMap=materialTexture('asphaltNormal',6);road.normalScale.set(.27,.34);road.roughnessMap=materialTexture('asphaltRough',6);road.roughness=night?.53:p.type==='jungle'?.6:.7;road.metalness=.1;road.envMapIntensity=night?.65:.45;road.clearcoat=night?.32:.16;road.clearcoatRoughness=.3;road.specularIntensity=.5;
 road.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nvarying vec2 deckUV;").replace("#include <uv_vertex>","#include <uv_vertex>\ndeckUV=uv;");shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\nvarying vec2 deckUV;").replace("#include <color_fragment>",`#include <color_fragment>
 vec2 grid=deckUV*vec2(8.,5.),panel=abs(fract(grid+.5)-.5),aa=max(fwidth(grid),vec2(.0001));vec2 seam=smoothstep(vec2(.006)-aa,vec2(.006)+aa,panel);diffuseColor.rgb*=mix(.58,1.,min(seam.x,seam.y));`).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
 float wet=sin(deckUV.x*9.+sin(deckUV.y*2.1))*sin(deckUV.y*5.7);float phase=deckUV.x*720.;float grain=sin(phase)*(1.-smoothstep(.5,3.,fwidth(phase)));roughnessFactor=max(.38,roughnessFactor+grain*.008-wet*.07);`);};
 view.materials.side.map=materialTexture('concrete');view.materials.side.normalMap=materialTexture('concreteNormal');view.materials.side.normalScale.set(.25,.25);view.materials.side.color.setHex(0x516a7e);view.materials.side.metalness=.8;view.materials.side.roughness=.28;
}
export function buildEnvironmentProps(view){view.grandstands=grandstandLayouts(view.track);buildArchitecture(view,materialTexture);buildHorizon(view.scene,view.environment.sky==='night',materialTexture);buildCloudCity(view,materialTexture);if(!['jungle','volcano','alpine','coast','desert','canyon'].includes(view.environment.type))buildHeroCity(view,materialTexture);buildLivingWorld(view,materialTexture);buildSkyDetail(view);if(['jungle','alpine'].includes(view.environment.type))buildEcosystem(view,materialTexture);if(view.environment.type==='volcano')buildVolcanicFX(view,materialTexture);buildBiome(view,materialTexture);buildEnvironmentDepth(view,materialTexture);buildReferenceWorld(view,materialTexture);buildImmersiveWorld(view,materialTexture);buildMotorsportKit(view,materialTexture);buildRoadArrows(view);buildTrackLife(view);}
export function createSentinel(){
 const g=new T.Group(),metal=new T.MeshPhysicalMaterial({color:0x9c1234,metalness:.8,roughness:.23,clearcoat:1}),dark=new T.MeshStandardMaterial({color:0x182b3c,metalness:.7,roughness:.32}),glow=new T.MeshBasicMaterial({color:new T.Color(0xff294b).multiplyScalar(2.5)});
 const add=(geo,mat,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
 add(new T.CylinderGeometry(1.12,1.4,.3,40),dark,0,.18);add(new T.CylinderGeometry(.48,.7,.85,32),metal,0,.7);add(new RoundedBoxGeometry(1.8,1.12,1.9,4,.24),metal,0,1.4);
 const alloy=new T.MeshStandardMaterial({color:0xafbcca,metalness:.85,roughness:.24});for(const x of [-.56,.56]){const b=add(new RoundedBoxGeometry(.16,1.16,2,2,.045),alloy,x,1.4);}
 for(let i=0;i<6;i++)add(new RoundedBoxGeometry(1.25,.04,.1,2,.014),dark,0,2, -.6+i*.23);
 for(const x of [-.75,.75]){const barrel=add(new T.CylinderGeometry(.42,.48,1.8,32),metal,x,1.55,-.38);barrel.rotation.x=Math.PI/2;const lens=add(new T.SphereGeometry(.29,32,20),glow,x,1.55,-1.29);lens.scale.z=.35;for(const z of [-1.15,-.7,0,.4]){const ring=add(new T.TorusGeometry(.47,.065,10,40),alloy,x,1.55,z);}}
 const halo=add(new T.TorusGeometry(1.5,.065,12,64),glow,0,.12);halo.rotation.x=Math.PI/2;return g;
}

export function applyAtmosphere(view,choice='auto'){
 const auto={alpine:'day',coast:'day',desert:'sunset',jungle:'day',volcano:'sunset',skyline:'sunset',solar:'sunset',frozen:'day',grandprix:'day',canyon:'dawn',reactor:'dawn'};
 const id=choice==='auto'?(auto[view.track.definition.id]||'night'):choice;
 const profiles={sunset:{sky:'dusk',sun:0xffc796,key:2.6,fill:0x90bce8,fog:0x827b8e,background:.85,env:.5,offset:[-480,135,105]},dawn:{sky:'dawn',sun:0xffd4b8,key:2.15,fill:0xabc6f2,fog:0x99abb9,background:.65,env:.55,offset:[380,160,-180]},day:{sky:'dawn',sun:0xfff1d8,key:2.8,fill:0xc5ddff,fog:0xaac3d1,background:.9,env:.7,offset:[-240,380,-180]},night:{sky:'night',sun:0x9ab9ef,key:.75,fill:0x5272a9,fog:0x17243e,background:.3,env:.22,offset:[-240,380,-180]}};
 const p=profiles[id];if(!p)return;
 const sky=textures[p.sky].clone();sky.mapping=T.EquirectangularReflectionMapping;sky.needsUpdate=true;
 for(const t of view.environmentTextures||[])t.dispose();view.environmentTextures=[sky];view.scene.background=null;view.scene.backgroundIntensity=p.background;view.sky.material.uniforms.panorama.value=sky;view.sky.material.uniforms.intensity.value=p.background;view.sky.material.uniforms.night.value=id==='night'?1:0;
 view.sky.visible=true;view.sun.color.setHex(p.sun);view.sun.intensity=p.key;view.sunOffset.set(...p.offset);view.scene.fog.color.setHex(p.fog);view.scene.fog.density=id==='night'?.0006:.00045;
 view.scene.traverse(o=>{if(o.isHemisphereLight){o.color.setHex(p.fill);o.intensity=id==='night'?.28:.42;}});
 view.scene.environmentIntensity=p.env;view.scene.traverse(o=>{for(const m of (o.material?Array.isArray(o.material)?o.material:[o.material]:[]))if(m.userData.facadeStyle)m.emissiveIntensity=id==='night'?.9:.14;});
 // Separate prefiltered reflection capture follows the chosen lighting family.
 const pm=new T.PMREMGenerator(view.renderer),target=pm.fromEquirectangular(id==='sunset'?sunsetHDR:environmentHDR);pm.dispose();view.environmentTarget?.dispose();view.environmentTarget=target;view.scene.environment=target.texture;
 const night=id==='night';view.cloudVolume.material.uniforms.sunColor.value.setHex(night?0x8098bc:id==='sunset'?0xffd3ad:0xeaf1fa);view.cloudVolume.material.uniforms.shadeColor.value.setHex(night?0x152239:0x647b98);
 for(const b of view.cloudDetails)b.material.color.setHex(night?0x637d9f:id==='sunset'?0xe9d8c9:0xe5effb);
 view.environmentStats.atmosphere=id;if(view.bloom){view.bloom.strength=night?.44:.3;view.bloom.radius=.38;view.bloom.threshold=night?1.3:1.6;}for(const family of view.buildingPalette||[]){family.facade.emissiveIntensity=night?1.6:id==='sunset'?.68:.3;family.accent.color.setHex(family.style.accent).multiplyScalar(night?3.8:2.5);family.warm.color.setHex(family.style.warm).multiplyScalar(night?2.5:1.7);}view.scene.backgroundBlurriness=0;if(view.skyDetail){const u=view.skyDetail.material.uniforms;u.coverage.value=id==='night'?0:.6;view.skyDetail.visible=id!=='night';u.lightColor.value.setHex(id==='sunset'?0xffd7ab:id==='night'?0x637d9e:0xf3f5f2);u.shadeColor.value.setHex(id==='night'?0x12203b:0x8094ac);}
 if(['jungle','volcano','alpine','coast','desert','canyon'].includes(view.environment.type)){const volcanic=view.environment.type==='volcano';view.scene.fog.color.setHex(view.environment.fog);for(const b of view.cloudDetails){b.material.opacity=volcanic?.12:.25;b.material.color.setHex(volcanic?0x71666b:0xb4ceb9);}}
}

const highSkies=new Map();
export async function applySkyQuality(view,choice='4096'){
 const id=view.environmentStats.atmosphere,token=view.skyToken=(view.skyToken||0)+1;
 const max=Math.min(Number(choice),view.renderer.capabilities.maxTextureSize),key=id==='sunset'?'sunset':(id==='day'||id==='dawn')?'day':null;
 view.environmentStats.skyLoading=true;view.environmentStats.skyFallback=false;
 if(id==='night'){view.environmentStats.skyLoading=false;view.environmentStats.skyRenderer='analytic-screen-resolution';view.environmentStats.skyResolution=null;view.environmentStats.skyRasterSource=null;return;}
 try{
 let source=textures[id==='night'?'night':id==='sunset'?'dusk':'dawn'].image;
 if(key&&max>4096){if(!highSkies.has(key))highSkies.set(key,new T.TextureLoader().loadAsync(key==='sunset'?sunset8k:day8k));source=(await highSkies.get(key)).image;}
 if(view.disposed||token!==view.skyToken)return;
 let image=source;if(source.width>max){const c=document.createElement('canvas');c.width=max;c.height=Math.round(source.height*max/source.width);c.getContext('2d').drawImage(source,0,0,c.width,c.height);image=c;}
 const sky=new T.Texture(image);sky.colorSpace=T.SRGBColorSpace;sky.wrapS=T.RepeatWrapping;sky.generateMipmaps=false;sky.minFilter=T.LinearFilter;sky.needsUpdate=true;
 for(const t of view.environmentTextures||[])t.dispose();view.sky.material.uniforms.panorama.value=sky;view.scene.background=null;view.environmentTextures=[sky];view.environmentStats.skyRenderer='direct-panorama';view.environmentStats.skyRasterSource=key;view.environmentStats.skyResolution=[image.width,image.height];view.environmentStats.skyLoading=false;
 }catch(e){if(token===view.skyToken){view.environmentStats.skyLoading=false;view.environmentStats.skyFallback=true;console.warn('Using bundled standard sky:',e.message);}}
}
