// Server-owned combat in course coordinates. Geometry/physics are never accepted
// from clients. All distance tests wrap the same closed circuit used for racing.
export class PlayerCombat {
 constructor(room){this.room=room;this.missiles=[];this.bolts=[];this.mines=[];this.events=[];this.nextId=1;this.cooldowns=new Map();this.pickups=room.track.content.pickups.map(()=>0);}
 delta(a,b){const l=this.room.track.length;return ((b-a+l*1.5)%l+l)%l-l*.5;}
 racers(){return [...this.room.players.values()].filter(p=>p.active&&!p.dnf&&p.finishTimeMs==null&&p.sim.state==='racing'&&p.sim.respawnRemaining<=0);}
 event(type,p,other=null,kind=null){const e={id:this.nextId++,tick:this.room.tick,type,source:p?.id||null,target:other?.id||null,distance:(other||p)?.sim.distance||0,lane:(other||p)?.sim.lateral||0,kind};this.events.push(e);if(this.events.length>96)this.events.shift();return e;}
 target(owner){return this.racers().filter(p=>p.id!==owner.id&&p.sim.counter<=0&&this.delta(owner.sim.distance,p.sim.distance)>7&&this.delta(owner.sim.distance,p.sim.distance)<220&&Math.abs(p.sim.lateral-owner.sim.lateral)<9).sort((a,b)=>this.delta(owner.sim.distance,a.sim.distance)-this.delta(owner.sim.distance,b.sim.distance))[0];}
 use(p,baseUse){const s=p.sim,kind=s.item;if(s.respawnRemaining>0)return;if(!kind){this.fireBlaster(p);return;}if(s.cooldown>0)return;
  if(kind==='missile'){const target=this.target(p);if(!target){baseUse();return;}if(this.missiles.length>=48)return;this.missiles.push({id:this.nextId++,owner:p.id,target:target.id,distance:s.distance+5,lane:s.lateral,life:3,speed:240});this.event('launch',p,target,kind);}
  else if(kind==='mine'){if(this.mines.filter(m=>m.owner===p.id).length>=3||this.mines.length>=32)return;this.mines.push({id:this.nextId++,owner:p.id,distance:s.distance-8,lane:s.lateral,life:18,arm:.6});this.event('deploy',p,null,kind);}
  else if(kind==='emp'){for(const other of this.racers())if(other.id!==p.id&&Math.hypot(this.delta(s.distance,other.sim.distance),s.lateral-other.sim.lateral)<65){if(this.hit(p,other,.12,.55,kind))other.sim.energy=Math.max(0,other.sim.energy-.35);}for(const t of s.targets())if(Math.abs(t.distance-s.distance)<65)s.destroy(t.key);s.shield=Math.max(s.shield,1.5);s.threats=[];this.event('pulse',p,null,kind);}
  else{baseUse();this.event('defense',p,null,kind);if(kind==='counter'){this.bolts=this.bolts.filter(b=>b.owner===p.id||Math.abs(this.delta(s.distance,b.distance))>=100);this.missiles=this.missiles.filter(m=>{if(m.owner!==p.id&&Math.abs(this.delta(s.distance,m.distance))<100){this.event('intercept',p,null,kind);return false;}return true;});}return;}
  s.item=null;s.cooldown=.7;s.events.push({type:'use',kind});
 }
 fireBlaster(p){const s=p.sim;if(s.state!=='racing'||s.respawnRemaining>0||s.cooldown>0||s.energy<.025||this.bolts.length>=96)return;s.energy-=.025;s.cooldown=.23;this.bolts.push({id:this.nextId++,owner:p.id,distance:s.distance+4,lane:s.lateral,life:1.4,speed:330*Math.cos(s.heading),sideSpeed:330*Math.sin(s.heading)});this.event('blaster',p,null,'blaster');}
 hit(attacker,victim,damage,slow,kind){const s=victim.sim;if(s.state!=='racing'||s.respawnRemaining>0||victim.dnf||victim.finishTimeMs!=null)return false;if(s.shield>0||(kind!=='collision'&&s.counter>0)){this.event('blocked',attacker,victim,kind);return false;}
  const previous=s.hull;s.damage(damage);s.speed*=slow;const lost=(previous-s.hull)*s.ship.armor*100;attacker.combat.hits++;attacker.combat.damageDealt+=lost;victim.combat.damageTaken+=lost;victim.lastAttacker={id:attacker.id,tick:this.room.tick};this.event('hit',attacker,victim,kind);
  if(s.hull<=0){attacker.combat.kills++;this.event('destroyed',attacker,victim,kind);s.beginDestruction();s.events=s.events.filter(e=>e.type!=='ship-destroyed');victim.lastAttacker=null;}
  return true;
 }
 step(dt,previous){
  // Recovery and environmental KOs are broadcast even while excluded from combat.
  for(const p of this.room.players.values())for(const e of p.sim.events){
   if(e.type==='ship-destroyed'){
    let killer=null;if(p.lastAttacker&&this.room.tick-p.lastAttacker.tick<300){killer=this.room.players.get(p.lastAttacker.id);if(killer)killer.combat.kills++;}
    this.event('destroyed',killer,p,'impact');p.lastAttacker=null;
   }else if(['respawn','checkpoint','lap','skill','incoming','impact','blocked','pad','evade','intercept','destroy','no-target','gate-missed'].includes(e.type)){const event=this.event(e.type,p,null,e.kind||e.source);if(e.key){const h=p.sim.content.hazards[Number(e.key.split(':')[1])];event.distance=(p.sim.lap-1)*p.sim.length+h.distance;event.lane=h.lane;event.height=h.height;} }
  }
  const racers=this.racers();
  for(const p of racers)if(!p.sim.item&&p.lastInput.fire&&this.room.lastNow-p.lastInputAt<=250)this.fireBlaster(p);
  // Swept missile overlap catches impacts between fixed ticks, including lap seam.
  for(const m of this.missiles){m.life-=dt;const before=m.distance,target=this.room.players.get(m.target);if(target&&racers.includes(target)&&target.sim.counter<=0){const change=target.sim.lateral-m.lane;m.lane+=Math.sign(change)*Math.min(Math.abs(change),14*dt);}m.distance+=m.speed*dt;
   for(const p of racers){if(p.id===m.owner)continue;const d=this.delta(before,p.sim.distance);if(d>=-3&&d<=m.speed*dt+3&&Math.abs(p.sim.lateral-m.lane)<2.6){const owner=this.room.players.get(m.owner);if(owner)this.hit(owner,p,.32,.65,'missile');m.life=0;break;}}
  }this.missiles=this.missiles.filter(m=>m.life>0);
  for(const b of this.bolts){const before=b.distance;b.life-=dt;b.distance+=b.speed*dt;b.lane+=b.sideSpeed*dt;if(Math.abs(b.lane)>16){b.life=0;continue;}for(const p of racers){if(p.id===b.owner)continue;const delta=this.delta(before,p.sim.distance);if(delta>=-2.8&&delta<=b.speed*dt+2.8&&Math.abs(p.sim.lateral-b.lane)<2.3){const owner=this.room.players.get(b.owner);if(owner)this.hit(owner,p,.07,.97,'blaster');b.life=0;break;}}}this.bolts=this.bolts.filter(b=>b.life>0);
  for(const m of this.mines){m.life-=dt;m.arm-=dt;if(m.arm>0)continue;for(const p of racers){if(p.id===m.owner)continue;const old=previous.get(p.id)?.distance??p.sim.distance,d=this.delta(old,m.distance),travel=p.sim.distance-old;if((Math.abs(this.delta(m.distance,p.sim.distance))<3||d>=-3&&d<=travel+3)&&Math.abs(p.sim.lateral-m.lane)<3){const owner=this.room.players.get(m.owner);if(owner)this.hit(owner,p,.28,.6,'mine');m.life=0;this.event('detonate',owner,p,'mine');break;}}}this.mines=this.mines.filter(m=>m.life>0);
  // Hull contacts use swept longitudinal separation plus lateral overlap. Pushes
  // separate lanes; no contact is allowed to award artificial forward progress.
  for(let i=0;i<racers.length;i++)for(let j=i+1;j<racers.length;j++){
   const a=racers[i],b=racers[j],x=a.sim,y=b.sim,dx=this.delta(x.distance,y.distance),old=this.delta(previous.get(a.id)?.distance??x.distance,previous.get(b.id)?.distance??y.distance),lateral=y.lateral-x.lateral;
   if(!(Math.abs(dx)<5.5||Math.sign(dx)!==Math.sign(old)&&Math.abs(old)<12)||Math.abs(lateral)>=3.4)continue;
   if(x.shield>0||y.shield>0||x.respawnRemaining>0||y.respawnRemaining>0)continue; // brief spawn/shield phasing prevents spawn trapping
   const sign=Math.abs(lateral)>.02?Math.sign(lateral):(a.id<b.id?1:-1),overlap=3.5-Math.abs(lateral),mass=x.ship.armor+y.ship.armor;
   x.lateral=Math.max(-13.2,Math.min(13.2,x.lateral-sign*overlap*y.ship.armor/mass));y.lateral=Math.max(-13.2,Math.min(13.2,y.lateral+sign*overlap*x.ship.armor/mass));
   const key=[a.id,b.id].sort().join(':');if((this.cooldowns.get(key)||0)>this.room.tick)continue;this.cooldowns.set(key,this.room.tick+36);
   const impact=Math.min(.18,.015+Math.abs(x.speed-y.speed)*.0018+Math.abs(x.lateralVelocity-y.lateralVelocity)*.0007);this.hit(a,b,impact,.93,'collision');this.hit(b,a,impact,.93,'collision');a.combat.collisions++;b.combat.collisions++;
  }
  this.sharedPickups(racers,previous);
 }
 sharedPickups(racers,previous){for(let i=0;i<this.pickups.length;i++){
  if(this.pickups[i]>this.room.raceElapsed)continue;const pickup=this.room.track.content.pickups[i],candidates=[];
  for(const p of racers){if(p.sim.respawnRemaining>0)continue;const old=previous.get(p.id)?.distance??p.sim.distance,travel=p.sim.distance-old,delta=this.delta(old,pickup.distance);if(travel>0&&delta>=0&&delta<=travel&&Math.abs(p.sim.lateral-pickup.lane)<3)candidates.push({p,fraction:delta/travel});}
  candidates.sort((a,b)=>a.fraction-b.fraction||a.p.id.localeCompare(b.p.id));for(const {p}of candidates)if(p.sim.collect(pickup.kind)){this.pickups[i]=this.room.raceElapsed+7;this.event('pickup',p,null,pickup.kind);break;}
 }}
 snapshot(id){const p=this.room.player(id),target=this.target(p);return{lockTarget:target?{id:target.id,name:target.name,hullPoints:Math.ceil(target.sim.hull*target.sim.ship.armor*100)}:null,bolts:this.bolts.map(b=>({...b})),missiles:this.missiles.map(m=>({...m})),mines:this.mines.map(m=>({...m})),unavailablePickups:this.pickups.flatMap((time,index)=>time>this.room.raceElapsed?[index]:[]),events:this.events.filter(e=>this.room.tick-e.tick<180),stats:{...p.combat},incoming:this.missiles.some(m=>m.target===id),combatVersion:1};}
}
