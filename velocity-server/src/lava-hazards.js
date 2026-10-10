// Shared deterministic eruption clock. Never use wall time or render delta for damage.
export const LAVA_PERIOD=23;
export function lavaPhase(hazard,seconds){const cycle=Math.floor((seconds-hazard.offset)/LAVA_PERIOD),age=seconds-hazard.offset-cycle*LAVA_PERIOD;return {cycle,age,warning:cycle>=0&&age<3,airborne:cycle>=0&&age>=1&&age<3,burning:cycle>=0&&age>=3&&age<6};}
export function applyLavaHazards(sim,oldDistance){
 for(const [i,h]of (sim.content.lava||[]).entries()){
  const phase=lavaPhase(h,sim.step/60);if(!phase.burning)continue;
  const key=`lava:${i}:${phase.cycle}`;if(sim.fired.has(key))continue;
  const lap=Math.floor(sim.distance/sim.length);let hit=false;
  for(const k of [lap-1,lap,lap+1]){const d=k*sim.length+h.distance;if(sim.distance>=d-h.radius&&oldDistance<=d+h.radius&&Math.abs(sim.lateral-h.lane)<h.radius+1.2)hit=true;}
  if(hit){sim.fired.add(key);if(sim.shield<=0){sim.damage(.18);sim.speed*=.8;sim.events.push({type:'impact',source:'lava'});}else sim.events.push({type:'blocked',source:'lava'});}
 }
}
