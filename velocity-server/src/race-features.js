import {lavaPhase} from './lava-hazards.js';
export const SERVICE_SPEED=32;
export function serviceAt(content,distance,length,lateral){
 const d=((distance%length)+length)%length;
 return (content.service||[]).find(p=>d>=p.distance&&d<=p.distance+p.length&&Math.abs(lateral-p.lane)<=2.5)||null;
}
export function updateService(sim,dt){
 const pad=serviceAt(sim.content,sim.distance,sim.length,sim.lateral);
 const active=!!pad&&sim.speed<=SERVICE_SPEED&&!sim.boosting&&!sim.respawnRemaining&&sim.state==='racing';
 if(active){sim.hull=Math.min(1,sim.hull+.115*dt);sim.energy=Math.min(1,sim.energy+.23*dt);if(!sim.servicing)sim.events.push({type:'service',kind:'repair'});sim.serviceSeconds+=dt;}
 sim.servicing=active;
}
export function raceWarning(track,sim){
 const range=Math.max(75,sim.speed*2.2);
 for(const hazard of track.content.lava||[]){
  const distance=(hazard.distance-sim.distance%track.length+track.length)%track.length;if(distance>range)continue;
  const now=lavaPhase(hazard,sim.step/60),arrival=lavaPhase(hazard,sim.step/60+distance/Math.max(12,sim.speed));
  if((now.warning||now.burning||arrival.burning)&&Math.abs(sim.lateral-hazard.lane)<hazard.radius+2)return {kind:'lava',text:`LAVA ${Math.round(distance)} m · MOVE ${hazard.lane>=0?'LEFT':'RIGHT'}`};
 }
 if(sim.hull<.27)return {kind:'hull',text:'HULL CRITICAL · FIND A GREEN SERVICE LANE'};
 return null;
}
export function guideSample(track,distance,ship,speed){
 const k=track.curvature(distance),target=Math.max(34,Math.min(ship.speed,.54*(ship.handling/25)/Math.max(.0001,Math.abs(k))));
 return {lane:Math.max(-4,Math.min(4,k*540)),brake:speed>target+5,target};
}
