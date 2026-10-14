import {SHIPS} from '../src/catalog.js';
import {DRIVE_LIMIT} from '../src/road-width.js';
import {lavaPhase} from '../src/lava-hazards.js';
import {POWER_TUNING} from '../src/power-tuning.js';
/**
 * CHARTVOLT PATCH (14 Oct 2026, owner: "simulated ai ships ... the user in the practice can compete with the number
 * that the admin specify ... must simulate human behaviour and the ai race differently from each other ... light").
 *
 * An AI pilot is a seat in a PRACTICE room driven by this controller instead of a browser. It produces exactly the
 * input a human sends - throttle, brake, steer, boost, fire - and the room feeds it to an ordinary RaceSimulation, so
 * a bot obeys the same physics, track, pickups and towers as the player and can gain nothing a player cannot.
 *
 * Cheap by construction: a "think" (look ahead, pick a line, choose a speed) runs every 5-11 physics steps, and the
 * per-step work is a handful of multiplications and one curvature lookup. No allocation per step - the input object
 * is reused. Everything random comes from a seeded generator, so a room replays identically.
 *
 * Room-side rules live in race-room.mjs: bots exist only in a solo practice room (`trackChoice`), never in a
 * competition, a challenge or anything paid.
 */
export const MAX_AI_PILOTS=15;
export const AI_ID_PREFIX='ai-';
const NAMES=['Nova','Kite','Rook','Vela','Juno','Orin','Pike','Lyra','Dax','Mira','Zeph','Talon','Echo','Rhea','Bolt','Quill'];
const STEP=1/60;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
/** mulberry32: tiny, fast, good enough for personalities and the odd mistake. */
export function seededRandom(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const between=(r,a,b)=>a+(b-a)*r();
function shuffled(list,r){const out=list.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}

/**
 * How one bot drives. Every field is a habit, and the spread between bots is what makes them race differently:
 * a late braker, a gate hunter, a boost saver, a twitchy line, a slow starter.
 * `pace` is the share of the true corner limit the bot dares to use - kept below 1 so the field is beatable.
 */
export function makePersonality(r){
 return{
  pace:between(r,.8,.94),            // corner speed used, as a share of what the ship can actually hold
  lookahead:between(r,.75,1.25),      // seconds of road read ahead
  think:Math.round(between(r,5,11)),  // physics steps between decisions (~85-185 ms reaction)
  smooth:between(r,.18,.42),          // how quickly the stick follows the wanted steer
  line:between(r,-3.5,3.5),           // preferred lane on a straight
  apex:between(r,.25,.8),             // how far into the inside of a corner
  wobble:between(r,.3,1.3),wobbleHz:between(r,.15,.5),
  gateHunter:between(r,.3,1),pickupHunter:between(r,.2,.9),
  boostAt:between(r,.25,.85),         // energy needed before boosting: savers wait, spenders go early
  boostStop:between(r,.02,.2),
  mistakeRate:between(r,.012,.04),    // slips per second
  launchLeadMs:Math.round(between(r,120,1400)), // throttle before green; under 500 ms earns the perfect start
  itemDelay:between(r,.2,1.4),        // seconds a pickup is held before use
  react:between(r,.15,.45),           // seconds before a tower shot is noticed
  dodgeSkill:between(r,.65,.95),      // share of tower shots actually dodged
 };
}

/** The bot seats for a room: ids `ai-1`..`ai-n`, a name each, a spread of ships, a personality each. */
export function aiRoster(count,seed){
 if(!Number.isInteger(count)||count<1)return[];
 const r=seededRandom((seed^0x9e3779b9)>>>0),names=shuffled(NAMES,r),ships=shuffled(SHIPS.map(s=>s.id),r);
 return Array.from({length:Math.min(count,MAX_AI_PILOTS)},(_,i)=>({id:`${AI_ID_PREFIX}${i+1}`,name:`${names[i%names.length]} (AI)`,shipId:ships[i%ships.length],personality:makePersonality(r),seed:Math.floor(r()*0xffffffff)}));
}

/** Forward gap in metres from `local` to an item at `at` on a lap of `length`. */
const ahead=(at,local,length)=>{const g=at-local;return g>=0?g:g+length;};

export class AiPilot{
 constructor(personality,seed){
  this.p=personality;this.seed=seed>>>0;this.r=seededRandom(seed);
  this.input={throttle:false,brake:false,steer:0,boost:false,fire:false};
  this.targetLane=personality.line;this.wantSpeed=Infinity;this.boost=false;this.steer=0;
  this.nextThink=0;this.slip=null;this.itemSince=null;this.stuck=0;
 }
 /** One physics step. Returns the shared input object, which the room passes straight to sim.update(). */
 control(sim){
  const input=this.input;input.fire=false;
  if(sim.state!=='racing'||sim.respawnRemaining>0){input.throttle=sim.state==='countdown';input.brake=false;input.steer=0;input.boost=false;return input;}
  // Reason: a tower shot closes at ~220 m/s, so while one is in the air the bot re-plans every few steps instead of its usual habit.
  if(sim.step>=this.nextThink){this.think(sim);this.nextThink=sim.step+(sim.threats.some(t=>t.life>0)?3:this.p.think);}
  // Steering: aim the heading at the chosen lane and feed the road's own bend forward, the way a driver holds a corner.
  const ship=sim.ship,v=Math.max(8,sim.speed),motion=Math.min(1,Math.abs(sim.speed)/22)||.05;
  // Reason: a stick under 0.15 also lets the simulation ease the heading back to the road, so gentle gains are cancelled out; these are firm enough to cross the road in well under a second.
  const latVel=clamp((this.targetLane-sim.lateral)*2.2,-v*.3,v*.3),wantHeading=Math.asin(latVel/v);
  const wantYaw=sim.curvature(sim.distance)*sim.speed*Math.cos(sim.heading)+(wantHeading-sim.heading)*5;
  const steer=clamp(wantYaw/(ship.handling/25*.75*motion),-1,1);
  this.steer+=(steer-this.steer)*this.p.smooth;input.steer=this.steer;
  const lifting=this.slip?.kind==='lift';
  const over=sim.speed-this.wantSpeed;
  input.brake=!lifting&&over>9;input.throttle=!lifting&&!input.brake&&over<=0;
  input.boost=input.throttle&&this.boost;
  if(this.fireNow){input.fire=true;this.fireNow=false;}
  return input;
 }
 think(sim){
  const p=this.p,dt=p.think*STEP,length=sim.length,local=((sim.distance%length)+length)%length,v=Math.max(10,sim.speed),c=sim.content;
  // A human slips now and then: brakes late, lifts for no reason, or drifts off the line for a moment.
  if(this.slip&&sim.time>=this.slip.until)this.slip=null;
  if(!this.slip&&this.r()<p.mistakeRate*dt){const k=this.r();this.slip={kind:k<.4?'late':k<.7?'lift':'drift',until:sim.time+between(this.r,.4,1),drift:between(this.r,-3,3)};}
  // Speed: the tightest bend within the look-ahead decides how fast this bot dares to go.
  let bend=0,bendSign=0;for(const t of [0,.35,.7,1]){const k=sim.curvature(sim.distance+v*p.lookahead*t);if(Math.abs(k)>Math.abs(bend)){bend=k;}}
  bendSign=Math.sign(bend);
  const maxYaw=sim.ship.handling/25*.75,pace=p.pace+(this.slip?.kind==='late'?.12:0);
  this.wantSpeed=Math.abs(bend)>1e-5?maxYaw*pace/Math.abs(bend):Infinity;
  // Line: a preferred lane on the straights and a habitual side in a bend, plus a small human wobble.
  // Reason: corner speed here is capped by yaw rate, not by lane (measured: flipping the bend side moved lap times <1%), so this is how a bot LOOKS, not a speed trick.
  const edge=DRIVE_LIMIT-2;
  let lane=Math.abs(bend)>.0018?bendSign*p.apex*edge:p.line;
  lane+=Math.sin(sim.time*p.wobbleHz*6.283)*p.wobble+(this.slip?.kind==='drift'?this.slip.drift:0);
  // Opportunities, least important first so a later rule overrides an earlier one.
  const reach=v*1.4+25;
  if(!sim.item||sim.energy<.6)for(const x of c.pickups){const g=ahead(x.distance,local,length);if(g>8&&g<reach&&(x.kind==='energy'?sim.energy<.6:!sim.item)&&Math.abs(x.lane-lane)<6&&this.hunt(p.pickupHunter,x,sim.lap)){lane=x.lane;break;}}
  for(const x of c.pads){const g=ahead(x.distance,local,length);if(g>8&&g<reach&&Math.abs(x.lane-lane)<5){lane=x.lane;break;}}
  for(const [i,x] of (c.gates||[]).entries()){const g=ahead(x.distance,local,length),lap=x.distance>=local?sim.lap:sim.lap+1;if(g>5&&g<v*2+30&&!sim.gatesHit.has(`${lap}:${i}`)&&this.hunt(p.gateHunter,x,lap)){lane=x.lane+clamp(lane-x.lane,-1.5,1.5);break;}}
  // Dangers override everything: towers on the road, lava that is erupting, tower fire aimed at this ship.
  const dodge=(at,width)=>{if(Math.abs(at-lane)>=width)return;const left=at-width-.6,right=at+width+.6;lane=Math.abs(left)>edge?right:Math.abs(right)>edge?left:Math.abs(left-sim.lateral)<Math.abs(right-sim.lateral)?left:right;};
  for(const [i,h] of c.hazards.entries()){if(h.height>3)continue;const g=ahead(h.distance,local,length),lap=h.distance>=local?sim.lap:sim.lap+1;if(g>2&&g<v*1.2+25&&!sim.destroyed.has(`${lap}:${i}`))dodge(h.lane,3.4);}
  for(const h of c.lava||[]){const g=ahead(h.distance,local,length);if(g>0&&g<v*1.2+20){const ph=lavaPhase(h,sim.step/60+g/v);if(ph.warning||ph.burning)dodge(h.lane,h.radius+1.8);}}
  for(const t of sim.threats)if(t.life>0&&t.distance>sim.distance-2&&3-t.life>=p.react&&this.hunt(p.dodgeSkill,{distance:t.startDistance},sim.lap))dodge(t.aimLane??t.lane,3.6);
  this.targetLane=clamp(lane,-edge,edge);
  // Boost on open road only, and only once the tank reaches this bot's habit.
  const straight=this.wantSpeed>sim.speed+30;
  this.boost=straight&&(this.boost?sim.energy>p.boostStop:sim.energy>=p.boostAt);
  // Stuck against a wall or a tower: aim for the middle until moving again.
  this.stuck=sim.speed<4?this.stuck+dt:0;if(this.stuck>1.2)this.targetLane=0;
  this.useItems(sim,straight);
 }
 /** Whether this bot goes for one particular gate or capsule - decided once per item and lap, not re-rolled each think. */
 hunt(appetite,item,lap){const h=Math.imul(this.seed^Math.round(item.distance*8)^Math.imul(lap,0x27d4eb2d),0x9E3779B1)>>>0;return h/4294967296<appetite;}
 useItems(sim,straight){
  if(!sim.item||sim.cooldown>0){this.itemSince=null;return;}
  if(this.itemSince==null){this.itemSince=sim.time;return;}
  if(sim.time-this.itemSince<this.p.itemDelay)return;
  const k=sim.item;
  const go=k==='missile'||k==='seeker'?Boolean(sim.target(k==='seeker'?POWER_TUNING.seeker.range:180)):k==='overdrive'?straight:k==='counter'?sim.threats.some(t=>t.life>0):true;
  if(go){this.fireNow=true;this.itemSince=null;}
 }
}
