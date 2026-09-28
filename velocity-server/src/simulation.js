import {updateService} from './race-features.js';
import {applyLavaHazards} from './lava-hazards.js';
import {SHIPS,pickupAt,hazardAt} from './catalog.js';
export const PHYSICS_VERSION='velocity-3d-11';
export const RESPAWN_SECONDS=3;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class RaceSimulation{
  constructor(length,curvature=()=>0,config={}){this.competitiveCombat=Boolean(config.competitiveCombat);this.length=length;this.curvature=curvature;this.lapsTarget=Number.isInteger(config.laps)&&config.laps>=1&&config.laps<=10?config.laps:3;this.maxTime=Number.isFinite(config.maxSeconds)&&config.maxSeconds>0?config.maxSeconds:300;this.shipId='vanguard';this.seed=config.seed||0;this.trackId=config.trackId||'orbital';this.content=config.content||{pickups:Array.from({length:24},(_,i)=>pickupAt(i,length)),hazards:Array.from({length:12},(_,i)=>hazardAt(i,length)),pads:[]};this.reset();}
  get ship(){return SHIPS.find(s=>s.id===this.shipId)||SHIPS[0];}
  selectShip(id){if(this.state==='hangar'&&SHIPS.some(s=>s.id===id))this.shipId=id;}
  reset(){Object.assign(this,{state:'hangar',distance:0,lateral:0,lateralVelocity:0,heading:0,yawRate:0,speed:0,time:0,energy:1,hull:1,lap:1,checkpoints:0,bestLap:null,lapStart:0,shield:0,overdrive:0,boosting:false,throttle:false,braking:false,step:0,countdown:3,events:[],replay:[],respawns:0,respawnRemaining:0,servicing:false,serviceSeconds:0,item:null,fireHeld:false,cooldown:0,pickupCount:0,targetsHit:0,flash:0});this.used=new Set();this.destroyed=new Set();this.projectiles=[];this.threats=[];this.mines=[];this.fired=new Set();this.counter=0;this.threatCooldown=0;this.padUsed=new Set();this.padBoost=0;this.nearMisses=0;this.sectors=[];this.sectorStart=0;this.gatesHit=new Set();this.gatesMissed=new Set();this.skillScore=0;this.chain=0;this.maxChain=0;this.cleanCorner=0;this.cornerRewardAt=0;}
  start(){this.reset();this.state='countdown';}
  pause(){if(['racing','countdown'].includes(this.state)){this.pausedFrom=this.state;this.state='paused';}}
  resume(){if(this.state==='paused')this.state=this.pausedFrom;}
  finish(reason='finished'){if(this.state==='finished')return;this.state='finished';this.boosting=false;this.events.push({type:'finish',reason,time:this.time});}
  damage(amount){if(this.shield>0||this.respawnRemaining>0)return;this.hull=Math.max(0,this.hull-amount/this.ship.armor);this.flash=.35;this.chain=0;this.cleanCorner=0;}
  beginDestruction(){if(this.respawnRemaining>0||this.state!=='racing')return false;this.hull=0;this.respawnRemaining=RESPAWN_SECONDS;this.respawns++;this.servicing=false;this.speed=0;this.boosting=false;this.throttle=false;this.braking=false;this.lateralVelocity=0;this.yawRate=0;this.item=null;this.overdrive=0;this.padBoost=0;this.shield=0;this.counter=0;this.threats=[];this.events.push({type:'ship-destroyed',distance:this.distance,lane:this.lateral});return true;}
  recover(){this.respawnRemaining=0;this.hull=1;this.shield=3;this.speed=0;this.lateral=0;this.lateralVelocity=0;this.heading=0;this.yawRate=0;this.energy=Math.max(.4,this.energy);this.cooldown=.35;this.events.push({type:'respawn'});}
  targets(){const list=[];for(let lap=this.lap;lap<=this.lap+1;lap++)for(let i=0;i<this.content.hazards.length;i++){const h=this.content.hazards[i],distance=(lap-1)*this.length+h.distance,key=`${lap}:${i}`;if(!this.destroyed.has(key))list.push({...h,distance,key});}return list;}
  target(){return this.targets().find(h=>h.distance>this.distance+5&&h.distance<this.distance+180&&(h.height>0||Math.abs(h.lane-this.lateral)<5));}
  collect(kind){if(this.respawnRemaining>0)return false;if(kind==='energy')this.energy=clamp(this.energy+.4,0,1);else if(kind==='repair')this.hull=clamp(this.hull+.3,0,1);else {/* CHARTVOLT PATCH: a new weapon REPLACES the one held (owner, 28 Sep 2026) - the same rule for every racer, so it stays fair. */this.item=kind;}this.pickupCount++;this.events.push({type:'pickup',kind});return true;}
  destroy(key){if(this.destroyed.has(key))return;this.destroyed.add(key);this.targetsHit++;this.events.push({type:'destroy',key});}
  rewardSkill(points,label){this.chain=Math.min(5,this.chain+1);this.maxChain=Math.max(this.maxChain,this.chain);this.skillScore+=points*this.chain;this.energy=clamp(this.energy+.08,0,1);this.events.push({type:'skill',label,points:points*this.chain,chain:this.chain});}
  useItem(){if(this.respawnRemaining>0||!this.item||this.cooldown>0)return;const kind=this.item;
    if(kind==='missile'){const target=this.target();if(!target){this.events.push({type:'no-target'});return;}this.projectiles.push({distance:this.distance+5,lane:this.lateral,target:target.key,targetDistance:target.distance,targetLane:target.lane,height:1.6,targetHeight:target.height||1.6,startDistance:this.distance+5,startLane:this.lateral});}
    if(kind==='emp'){for(const t of this.targets())if(Math.abs(t.distance-this.distance)<65)this.destroy(t.key);this.shield=Math.max(this.shield,1.5);this.threats=[];}
    if(kind==='shield')this.shield=6;if(kind==='overdrive')this.overdrive=5;if(kind==='counter'){this.counter=4;this.threats=[];}if(kind==='mine')this.mines.push({distance:this.distance+18,lane:this.lateral,life:12,arm:.5});
    this.item=null;this.cooldown=.7;this.events.push({type:'use',kind});
  }
  update(dt,input={}){
    this.events.length=0;
    if(this.state==='countdown'){this.countdown-=dt;if(this.countdown<=0){this.state='racing';this.events.push({type:'start'});}return;}
    if(this.state!=='racing')return;this.step++;this.time+=dt;
    if(this.respawnRemaining>0){this.respawnRemaining=Math.max(0,this.respawnRemaining-dt);this.speed=0;this.throttle=false;this.braking=false;this.boosting=false;this.fireHeld=Boolean(input.fire);if(this.time>=this.maxTime){this.finish('time-up');return;}if(this.respawnRemaining<1e-8)this.recover();return;}
    if(this.hull<=0){this.beginDestruction();if(this.time>=this.maxTime)this.finish('time-up');return;}
    for(const k of ['shield','overdrive','cooldown','flash','counter','threatCooldown','padBoost'])this[k]=Math.max(0,this[k]-dt);
    this.throttle=Boolean(input.throttle);this.braking=Boolean(input.brake);
    const steer=clamp(input.steer||0,-1,1),ship=this.ship;
    this.boosting=Boolean(input.boost)&&this.throttle&&!this.braking&&this.energy>.02;
    const limit=ship.speed+(this.boosting?(ship.boostExtra||36):0)+(this.overdrive>0?22:0)+(this.padBoost>0?18:0);
    if(this.braking)this.speed=Math.max(0,this.speed-78*dt);
    else if(this.throttle)this.speed=clamp(this.speed+ship.acceleration*(this.boosting?1.65:1)*(1-this.speed/(limit*1.14))*dt,0,limit);
    else this.speed=Math.max(0,this.speed-(8+this.speed*.055)*dt);
    this.energy=clamp(this.energy+dt*(this.boosting?-(ship.boostDrain||.22):.075),0,1);
    const motion=Math.min(1,this.speed/22),grip=this.braking?6:4;
    this.yawRate+=(steer*ship.handling/25*.75*motion-this.yawRate)*Math.min(1,dt*grip);
    this.heading=clamp(this.heading+(this.yawRate-this.curvature(this.distance)*this.speed*Math.cos(this.heading))*dt,-1.3,1.3);
    this.lateralVelocity=this.speed*Math.sin(this.heading);
    this.lateral+=this.lateralVelocity*dt;
    if(Math.abs(this.lateral)>13.3){this.lateral=Math.sign(this.lateral)*13.3;this.heading*=-.25;this.lateralVelocity*=-.25;this.speed*=.83;this.damage(Math.min(.09,this.speed*.001));this.events.push({type:'impact'});}
    if(input.fire&&!this.fireHeld)this.useItem();this.fireHeld=Boolean(input.fire);
    for(const p of this.projectiles){p.distance+=240*dt;p.height=1.6+((p.targetHeight||1.6)-1.6)*Math.min(1,(p.distance-p.startDistance)/Math.max(1,p.targetDistance-p.startDistance));p.lane=p.startLane+(p.targetLane-p.startLane)*Math.min(1,(p.distance-p.startDistance)/Math.max(1,p.targetDistance-p.startDistance));if(p.distance>=p.targetDistance)this.destroy(p.target);}
    this.projectiles=this.projectiles.filter(p=>p.distance<p.targetDistance);
    this.updateCombat(dt);
    const old=this.distance;this.distance+=this.speed*Math.cos(this.heading)*dt;
    for(const h of this.targets())if(!(h.height>3)&&old<h.distance&&this.distance>=h.distance&&Math.abs(this.lateral-h.lane)<2.4){this.destroyed.add(h.key);if(this.shield<=0){this.damage(.28);this.speed*=.55;this.events.push({type:'impact'});}else this.events.push({type:'blocked'});}
    applyLavaHazards(this,old);
    if(this.hull<=0){this.beginDestruction();if(this.time>=this.maxTime)this.finish('time-up');return;}
    for(let i=0;i<(this.content.gates||[]).length;i++){const gate=this.content.gates[i],key=`${this.lap}:${i}`,at=(this.lap-1)*this.length+gate.distance;if(old<at&&this.distance>=at){if(Math.abs(this.lateral-gate.lane)<3.2&&this.speed>45){this.gatesHit.add(key);this.rewardSkill(100,'PRECISION GATE');}else{this.gatesMissed.add(key);this.chain=0;this.events.push({type:'gate-missed'});}}}
    if(this.speed>65&&Math.abs(this.curvature(this.distance))>.003&&Math.abs(this.lateral)<9&&!this.braking)this.cleanCorner+=dt;else this.cleanCorner=0;if(this.cleanCorner>2&&this.distance-this.cornerRewardAt>180){this.rewardSkill(60,'CLEAN CORNER');this.cornerRewardAt=this.distance;this.cleanCorner=0;}
    const sector=this.length/8,passed=Math.floor(this.distance/sector),previous=Math.floor(old/sector);
    if(passed>previous){this.sectors.push(this.time-this.sectorStart);this.sectorStart=this.time;this.checkpoints=passed;this.events.push({type:'checkpoint',checkpoint:passed});}
    for(let i=0;!this.competitiveCombat&&i<this.content.pickups.length;i++){const p=this.content.pickups[i],key=`${this.lap}:${i}`,absolute=(this.lap-1)*this.length+p.distance;
      if(old<absolute&&this.distance>=absolute&&!this.used.has(key)&&Math.abs(this.lateral-p.lane)<3&&this.collect(p.kind))this.used.add(key);
    }
    for(let i=0;i<this.content.pads.length;i++){const p=this.content.pads[i],key=`${this.lap}:${i}`,d=(this.lap-1)*this.length+p.distance;if(old<d&&this.distance>=d&&Math.abs(this.lateral-p.lane)<3&&!this.padUsed.has(key)){this.padUsed.add(key);this.padBoost=2.5;this.energy=clamp(this.energy+.1,0,1);this.events.push({type:'pad'});}}
    updateService(this,dt);
    const completed=Math.floor(this.distance/this.length);
    if(completed>=this.lap){const lapTime=this.time-this.lapStart;this.bestLap=this.bestLap===null?lapTime:Math.min(this.bestLap,lapTime);this.lapStart=this.time;this.lap=completed+1;this.events.push({type:'lap',lap:completed});if(completed>=this.lapsTarget){this.finish();return;}}
    if(this.time>=this.maxTime)this.finish('time-up');
  }
  updateCombat(dt){
    if(this.threatCooldown<=0&&this.counter<=0){const h=this.targets().find(h=>h.distance-this.distance>90&&h.distance-this.distance<170&&(h.height>0||Math.abs(h.lane-this.lateral)<5)&&!this.fired.has(h.key));if(h){this.fired.add(h.key);this.threatCooldown=7;this.threats.push({distance:h.distance,lane:h.lane,height:h.height||1.4,startDistance:h.distance,startLane:h.lane,startHeight:h.height||1.4,aimDistance:this.distance+this.speed*(h.distance-this.distance)/(105+this.speed),aimLane:this.lateral,life:3,source:h.key});this.events.push({type:'incoming'});}}
    for(const m of this.mines){m.life-=dt;m.arm-=dt;if(m.arm<=0){for(const h of this.targets())if(Math.abs(h.distance-m.distance)<20&&Math.abs(h.lane-m.lane)<4){this.destroy(h.key);m.life=0;}for(const p of this.threats)if(Math.abs(p.distance-m.distance)<18&&Math.abs(p.lane-m.lane)<4){p.life=0;m.life=0;this.events.push({type:'intercept'});}}}
    this.mines=this.mines.filter(m=>m.life>0);
    for(const p of this.threats){if(p.life<=0)continue;const old=p.distance;p.distance-=105*dt;p.life-=dt;if(p.aimDistance!==undefined){const u=Math.max(0,Math.min(1,(p.startDistance-p.distance)/Math.max(1,p.startDistance-p.aimDistance)));p.lane=p.startLane+(p.aimLane-p.startLane)*u;p.height=p.startHeight+(1.4-p.startHeight)*u;}if(old>=this.distance&&p.distance<=this.distance+this.speed*dt){if(Math.abs(p.lane-this.lateral)<3&&(p.height===undefined||p.height<3.4)&&this.shield<=0&&this.counter<=0){this.damage(.16);this.speed*=.86;this.events.push({type:'impact'});}else {this.nearMisses++;this.rewardSkill(75,'CLEAN EVADE');this.events.push({type:'evade'});}p.life=0;}}
    this.threats=this.threats.filter(p=>p.life>0);
  }
  result(){return {physicsVersion:PHYSICS_VERSION,serviceSeconds:this.serviceSeconds,skillScore:this.skillScore,maxChain:this.maxChain,gates:this.gatesHit.size,shipId:this.shipId,trackId:this.trackId,seed:this.seed,sectors:this.sectors.slice(),nearMisses:this.nearMisses,timeMs:Math.round(this.time*1000),bestLapMs:this.bestLap===null?null:Math.round(this.bestLap*1000),lapsCompleted:Math.min(this.lapsTarget,this.lap-1),checkpoints:this.checkpoints,respawns:this.respawns,pickups:this.pickupCount,targetsHit:this.targetsHit,finished:this.lap>this.lapsTarget};}
}
