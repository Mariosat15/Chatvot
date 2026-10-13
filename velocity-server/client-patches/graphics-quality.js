// Rendering-only settings. Never changes simulation, race seed or driving geometry.
// CHARTVOLT PATCH (13 Oct 2026, owner: iOS killed the practice tab - "A problem repeatedly
// occurred"): with `release` set (touch devices), a texture keeps only the size it is drawn at.
// The vendor kept every decoded original in `originals` and every downscaled canvas in `scaled`
// for the life of the page, so a phone held the 2K/4K source of every texture beside its 1024 copy,
// and Safari counts canvases against a fixed budget. Released, a texture cannot be restored to a
// higher setting until the page is reloaded - an accepted cost, since a phone starts on Low anyway.
const originals=new WeakMap(),scaled=new WeakMap();
export function applyGraphicsQuality(view,options){
 const clouds={low:10,medium:20,high:36}[options.clouds]||20;
 view.cloudVolume.material.uniforms.steps.value=clouds;view.cloudVolume.visible=options.clouds!=='low'&&!['jungle','volcano','alpine','coast','desert'].includes(view.environment.type);
 view.cloudDetails.forEach((s,i)=>s.visible=options.clouds!=='low'||i%2===0);
 const shadow=Math.min(view.renderer.capabilities.maxTextureSize,{off:0,low:1024,medium:2048,high:4096}[options.shadows]??2048);
 view.renderer.shadowMap.enabled=shadow>0;view.sun.castShadow=shadow>0;
 if(shadow&&view.sun.shadow.mapSize.x!==shadow){view.sun.shadow.map?.dispose();view.sun.shadow.map=null;view.sun.shadow.mapSize.setScalar(shadow);}
 view.renderer.shadowMap.needsUpdate=true;view.sun.shadow.normalBias=shadow?Math.max(.045,250/shadow*.8):.2;view.sun.shadow.bias=-.00015;
 /* CHARTVOLT PATCH (13 Oct 2026): on a touch device facade detail is drawn to 220 m rather than 350 m, and neither those small parts nor the scanned cliff faces (about 20,000 triangles an instance) cast shadows - at phone size neither change is visible, while the shadow pass was re-drawing every one of them each frame. */
 view.detailRange=options.release?220:350;for(const cell of [...(view.detailCells||[]),...(view.scanCells||[])])cell.traverse(o=>{if(!o.isMesh)return;o.userData.castShadow??=o.castShadow;o.castShadow=options.release?false:o.userData.castShadow;});
 const max={low:1024,medium:2048,high:4096}[options.textures]||1024,materials=new Set(),release=!!options.release;
 view.scene.traverse(o=>{if(o.userData.environmentFullCount!=null)o.count=Math.ceil(o.userData.environmentFullCount*(options.textures==='low'?.6:1));for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});
 for(const m of materials){for(const key of ['map','normalMap','roughnessMap','emissiveMap','metalnessMap','aoMap']){const tex=m[key];if(!tex?.image||tex.image.data)continue;if(tex.userData.preserveResolution&&options.textures!=='low')continue;
 const texMax=(tex.userData.facadeTexture&&options.textures==='low'?512:max)>>(release&&key!=='map'&&key!=='emissiveMap'?1:0);
 if(release){const image=tex.image;if(image.width&&image.height&&Math.max(image.width,image.height)>texMax){const c=document.createElement('canvas'),ratio=texMax/Math.max(image.width,image.height);c.width=Math.max(1,Math.round(image.width*ratio));c.height=Math.max(1,Math.round(image.height*ratio));c.getContext('2d').drawImage(image,0,0,c.width,c.height);tex.image=c;tex.needsUpdate=true;}tex.anisotropy=2;}
 else{if(!originals.has(tex.source))originals.set(tex.source,tex.image);const source=originals.get(tex.source);if(!source.width||!source.height)continue;
 let target=source;if(Math.max(source.width,source.height)>texMax){let levels=scaled.get(source);if(!levels){levels=new Map();scaled.set(source,levels);}if(!levels.has(texMax)){const c=document.createElement('canvas'),ratio=texMax/Math.max(source.width,source.height);c.width=Math.max(1,Math.round(source.width*ratio));c.height=Math.max(1,Math.round(source.height*ratio));c.getContext('2d').drawImage(source,0,0,c.width,c.height);levels.set(texMax,c);}target=levels.get(texMax);}if(tex.image!==target){tex.image=target;tex.needsUpdate=true;}tex.anisotropy=options.textures==='low'?2:Math.min(8,view.renderer.capabilities.getMaxAnisotropy());}}
 if(m.isMeshStandardMaterial){m.envMapIntensity=options.reflections==='off'?0:(m.userData.originalEnv??=m.envMapIntensity);}}
 view.graphicsQuality={...options,cloudSteps:clouds,cloudMode:options.clouds==='low'?'cards':'volume-and-cards',shadowResolution:shadow,textureMax:max,facadeTextureMax:options.textures==='low'?512:(view.facadeMaps.styles[0].albedo.userData.facadeTextureResolution||1024),largestMaterialTexture:Math.max(0,...[...materials].flatMap(m=>['map','normalMap','roughnessMap','emissiveMap'].map(k=>Math.max(m[k]?.image?.width||0,m[k]?.image?.height||0))))};view.environmentStats.graphics=view.graphicsQuality;
}
