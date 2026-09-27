// Shared wire contract. Only the server produces authoritative snapshots.
export const PROTOCOL_VERSION=2;
export const EMPTY_INPUT=Object.freeze({steer:0,throttle:false,brake:false,boost:false,fire:false});
const numbers=['distance','lateral','lateralVelocity','heading','yawRate','speed','time','energy','hull','lap','checkpoints','bestLap','lapStart','shield','overdrive','step','countdown','respawns','respawnRemaining','cooldown','pickupCount','targetsHit','flash','counter','threatCooldown','padBoost','nearMisses','sectorStart','skillScore','chain','maxChain','cleanCorner','cornerRewardAt','serviceSeconds'];
const flags=['state','shipId','item','boosting','throttle','braking','fireHeld','servicing'];
const sets=['used','destroyed','fired','padUsed','gatesHit','gatesMissed'];
const arrays=['projectiles','threats','mines','sectors'];
export function serializeSimulation(sim){const value={};for(const k of [...numbers,...flags])value[k]=sim[k];for(const k of sets)value[k]=[...sim[k]];for(const k of arrays)value[k]=sim[k].map(x=>typeof x==='object'?{...x}:x);return value;}
export function restoreSimulation(sim,value){for(const k of [...numbers,...flags])if(Object.hasOwn(value,k))sim[k]=value[k];for(const k of sets)sim[k]=new Set(value[k]||[]);for(const k of arrays)sim[k]=(value[k]||[]).map(x=>typeof x==='object'?{...x}:x);sim.events=[];}
export function validateInput(v){if(!v||!Number.isFinite(v.steer)||Math.abs(v.steer)>1)return null;for(const k of ['throttle','brake','boost','fire'])if(typeof v[k]!=='boolean')return null;return Object.fromEntries(Object.keys(EMPTY_INPUT).map(k=>[k,v[k]]));}
export function standings(players){
 const rows=players.map(p=>({id:p.id,name:p.name,shipId:p.sim.shipId,distance:p.sim.distance,lap:Math.min(p.sim.lap,p.sim.lapsTarget),checkpoints:p.sim.checkpoints,finishTimeMs:p.finishTimeMs??null,status:p.dnf?'dnf':p.finishTimeMs!=null?'finished':p.sim.state==='hangar'?'waiting':'racing',connected:p.connected,ready:p.ready}));
 rows.sort((a,b)=>Number(a.status==='dnf')-Number(b.status==='dnf')||Number(b.finishTimeMs!==null)-Number(a.finishTimeMs!==null)||(a.finishTimeMs!==null&&b.finishTimeMs!==null?a.finishTimeMs-b.finishTimeMs:b.checkpoints-a.checkpoints||b.distance-a.distance)||a.id.localeCompare(b.id));
 for(let i=0;i<rows.length;i++){const r=rows[i],previous=rows[i-1];r.position=r.status==='dnf'?null:previous&&r.finishTimeMs!==null&&r.finishTimeMs===previous.finishTimeMs?previous.position:i+1;r.gapMetres=r.finishTimeMs!==null?null:Math.max(0,(rows.find(x=>x.status!=='dnf')?.distance||0)-r.distance);}
 return rows;
}
