import * as T from 'three';
// Original, resolution-independent decal artwork baked once per selected ship.
// Sampling uses model-space projection, stable mipmaps and real paint materials.
// CHARTVOLT PATCH (13 Oct 2026): baked once per ship TYPE, not once per hull. Every rival used to
// paint and upload its own 1024x1024 canvas (~5.6 MB of GPU memory with mipmaps) at the moment it
// appeared, which was a visible hitch and ~84 MB at 16 racers. The artwork depends only on
// (index, colour), so hulls of one type share one texture. Touch devices bake at 512x512: the decal
// covers a few hundred pixels of a phone screen at most.
const cache=new Map();
export function fleetLivery(index,color){
 if(typeof document==='undefined')return null;
 const key=`${index}:${color}`,cached=cache.get(key);if(cached)return cached;
 const size=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches?512:1024;
 const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');
 x.clearRect(0,0,size,size);x.save();x.translate(size/2,size/2);x.scale(size/14,size/16);
 const ink=['#fcfcf2','#eef0ff','#152130','#faf4e9','#e8d4aa','#e9d9ff','#222e3e','#ecf9fb'][index],team='#'+new T.Color(color).getHexString();
 for(const sign of [-1,1]){
 x.save();x.scale(sign,1);x.fillStyle=team;x.beginPath();x.moveTo(.65,-7);x.lineTo(1.12,-7);x.lineTo(2.6,5.5);x.lineTo(1.35,5.5);x.closePath();x.fill();
 x.fillStyle=ink;x.beginPath();x.moveTo(2.1,-2.7);x.lineTo(2.65,-2.4);x.lineTo(5.5,2.7);x.lineTo(4.8,2.7);x.closePath();x.fill();
 for(let j=0;j<3;j++){x.fillStyle=ink;x.fillRect(1.6+j*.22,1.8,.11,.75);}
 x.restore();
 }
 x.fillStyle=ink;x.font='900 1.4px Arial';x.textAlign='center';x.fillText(String(index+1).padStart(2,'0'),0,2.75);
 x.font='bold .32px Arial';x.fillText('CHARTVOLT',0,3.3);x.font='bold .18px Arial';x.fillText('VOLT RACING DIVISION',0,3.64);
 x.strokeStyle=ink;x.lineWidth=.045;for(const sign of [-1,1]){x.strokeRect(sign*1.65-.2,-1.8,.4,.7);x.fillStyle='#ffbc68';x.fillRect(sign*1.65-.14,-1.64,.28,.11);}
 x.restore();const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.minFilter=T.LinearMipmapLinearFilter;tex.anisotropy=8;cache.set(key,tex);return tex;
}
