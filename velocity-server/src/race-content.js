import {rng} from './tracks.js';
import {road} from './road-width.js';
import {SPECIAL_KINDS} from './power-tuning.js';
export function generateContent(track,seed){const r=rng(seed),length=track.length,curvature=track.curvature||(()=>0),bag=['energy','energy','energy','energy','energy','repair','repair','repair','repair','repair','shield','shield','shield','shield','counter','counter','counter','missile','missile','emp','mine','mine','overdrive','overdrive'];
 for(let i=bag.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
 const pickups=[];for(let i=0;i<24;i++){const span=(length-300)/24;let distance=150+span*(i+.1+r()*.7);let best=distance,score=Math.abs(curvature(distance));for(let j=0;j<3;j++){const d=150+span*(i+.1+r()*.7),c=Math.abs(curvature(d));if(c<score){best=d;score=c;}}const lane=road(-8+r()*16);pickups.push({distance:best,lane,kind:bag[i]});}
 const hazards=[];for(let i=0;i<12;i++){let distance=length*(i+1.1)/13;for(const p of pickups)if(Math.abs(distance-p.distance)<45)distance+=60;hazards.push({distance:Math.min(length-80,distance),lane:road((i%2?1:-1)*(23+r()*3)),height:9+r()*4});}
 const pads=pickups.filter((p,i)=>i%4===1&&Math.abs(curvature(p.distance+40))<.008).map(p=>({distance:p.distance+40,lane:-p.lane}));
 const gates=Array.from({length:8},(_,i)=>({distance:length*(i+.6)/8,lane:road((i%2?1:-1)*(3+r()*4))}));
 const lava=track.definition?.id==='volcano'?Array.from({length:14},(_,i)=>({distance:length*(i+.6)/14,lane:road((i%2?1:-1)*(4+r()*4)),offset:6+r()*17,radius:2.8+r()*.6})):[];const service=[.32,.73].map((f,i)=>{let distance=length*f,score=Infinity;for(let j=-5;j<=5;j++){const d=length*f+j*12,k=Math.max(...[0,20,40,60].map(o=>Math.abs(curvature(d+o))));if(k<score){score=k;distance=d;}}return {distance,lane:road(i%2?-9.5:9.5),length:62};});return {seed:seed>>>0,pickups:withSpecials(pickups,seed),hazards,pads,gates,lava,service};
}
/* CHARTVOLT PATCH (28 Sep 2026): the five new power-ups ride on EXTRA capsules. The vendor's 24 keep their exact
 * draws, so every seed still lays out the same 24 capsules, hazards, pads and gates as before, and the vendor's
 * per-kind quotas hold. Reason: the extras use their own random stream and are spliced in distance order into
 * gaps of at least SPECIAL_MIN_GAP, so no capsule ever sits closer than half that to a neighbour. */
export const SPECIAL_MIN_GAP=50;
const SPECIAL_GAPS=[2,7,12,17,22];
function withSpecials(base,seed){const r=rng((seed^0x5bd1e995)>>>0),kinds=[...SPECIAL_KINDS];
 for(let i=kinds.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
 const taken=new Set(),extras=[];
 for(let k=0;k<SPECIAL_GAPS.length;k++){const lane=road(-8+r()*16);
  const gap=[0,1,-1,2,-2].map(o=>SPECIAL_GAPS[k]+o).find(g=>g>=0&&g<base.length-1&&!taken.has(g)&&base[g+1].distance-base[g].distance>=SPECIAL_MIN_GAP);
  if(gap===undefined)continue;taken.add(gap);extras.push({after:gap,pickup:{distance:(base[gap].distance+base[gap+1].distance)/2,lane,kind:kinds[k]}});}
 const out=[];for(let i=0;i<base.length;i++){out.push(base[i]);for(const e of extras)if(e.after===i)out.push(e.pickup);}return out;}
