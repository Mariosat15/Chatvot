import {PlayerCombat} from './player-combat.mjs';
import {RaceSimulation,PHYSICS_VERSION} from '../src/simulation.js';
import {createTrack} from '../src/track.js';
import {generateContent} from '../src/race-content.js';
import {SHIPS} from '../src/catalog.js';
import {TRACKS,rng,ROUTE_VERSION} from '../src/tracks.js';
import {EMPTY_INPUT,validateInput,serializeSimulation,standings,PROTOCOL_VERSION} from '../src/multiplayer-state.js';
import {decodeFrame,MAX_FRAMES_PER_MESSAGE} from '../src/input-frames.js';
export const MAX_RACERS=16;
/**
 * CHARTVOLT PATCH. Upper bound on step frames waiting to be applied (~167 ms). A burst after a
 * network stall would otherwise make this player run late for the rest of the race; beyond the
 * bound the oldest frames are dropped (their fire press carried forward) and the client's
 * reconciliation absorbs the small correction.
 */
export const MAX_QUEUED_FRAMES=10;
/** The countdown the vendor start() applies to an unscheduled (all-ready) race. */
export const COUNTDOWN_MS=5000;
/** CHARTVOLT PATCH. The countdown a scheduled race runs once the start time has passed and two pilots are Ready (owner, 28 Sep 2026). */
export const SCHEDULED_COUNTDOWN_MS=10000;
/** CHARTVOLT PATCH. A pilot who arrives after the green light gets this personal countdown; their lateness still counts against their time. */
export const LATE_JOIN_COUNTDOWN_S=3;
/** CHARTVOLT PATCH. Without a `latestStartAt` in the spec, a scheduled lobby waits this long past its start for a second Ready pilot. */
export const DEFAULT_START_WAIT_MS=5*60*1000;
/** How far ahead a scheduled start may be booked; bounds how long an idle lobby holds memory. */
export const MAX_SCHEDULE_AHEAD_MS=6*60*60*1000;
/** CHARTVOLT PATCH. Laps an operator may choose, and the time allowed per lap (the race limit is laps x this). */
export const MIN_LAPS=1,MAX_LAPS=10,DEFAULT_LAPS=3,SECONDS_PER_LAP=100;
const PLAYER_ID=/^[-\w]{1,80}$/;
function validRosterEntry(p){return p&&PLAYER_ID.test(p.id)&&typeof p.name==='string'&&Boolean(p.name.trim())&&p.name.length<=40;}
export class RaceRoom {
 /**
  * CHARTVOLT PATCH (see CHARTVOLT-PATCHES.md). Two optional spec fields:
  *  - `openRoster: true`  - the roster may start with 0-16 players and grow via addPlayer() while in lobby.
  *  - `scheduledStartAt`  - epoch ms. The all-ready auto start is disabled. Once this moment has passed AND
  *                          at least two connected pilots are Ready (ship picked, Launch pressed), a
  *                          SCHEDULED_COUNTDOWN_MS countdown runs; ships cannot move until it reaches 0
  *                          (owner decision 28 Sep 2026, replacing the 27 Sep "green at the moment with
  *                          everyone connected"). Pilots who are not Ready do not race until they are.
  *                          A pilot may still enter, pick a ship and Launch after the start - the race
  *                          clock does not wait for them, so lateness counts against their time.
  *  - `latestStartAt`     - epoch ms, optional, >= scheduledStartAt. If two Ready pilots have not appeared
  *                          by then the race is 'cancelled' ('too-few-ready'). Default: start + 5 minutes.
  *  - `laps`            - integer 1-10 (default 3). The race limit is laps x 100 s, so 3 laps keeps the
  *                          vendor's 300 s exactly.
  *  - `solo: true`        - exactly one registered pilot, frozen, unscheduled; the race starts when that
  *                          pilot is Ready. An "each plays alone" competition gives every round its own room.
  * Without these fields the vendor behaviour is byte-for-byte unchanged (2-16 frozen, all-ready start).
  */
 constructor(spec,now=Date.now()){
  const open=spec?.openRoster===true,solo=spec?.solo===true,minPlayers=open?0:solo?1:2;
  const laps=spec?.laps===undefined||spec?.laps===null?DEFAULT_LAPS:spec.laps;
  if(!Number.isInteger(laps)||laps<MIN_LAPS||laps>MAX_LAPS)throw Error('Invalid laps (1-10)');
  // Reason: a solo room is one pilot's private race - growing it, or scheduling it against a clock, would make it a shared race wearing the wrong label.
  if(solo&&(open||spec.players?.length!==1||(spec.scheduledStartAt!==undefined&&spec.scheduledStartAt!==null)))throw Error('Invalid solo race (exactly one pilot, frozen, unscheduled)');
  if(!spec||!PLAYER_ID.test(spec.id)||!TRACKS.some(t=>t.id===spec.trackId)||!Number.isInteger(spec.seed)||spec.seed<0||spec.seed>0xffffffff||!Array.isArray(spec.players)||spec.players.length<minPlayers||spec.players.length>MAX_RACERS)throw Error('Invalid race configuration (2–16 registered players required)');
  if(new Set(spec.players.map(p=>p.id)).size!==spec.players.length||!spec.players.every(validRosterEntry))throw Error('Invalid roster');
  if(spec.scheduledStartAt!==undefined&&spec.scheduledStartAt!==null){if(!Number.isSafeInteger(spec.scheduledStartAt)||spec.scheduledStartAt>now+MAX_SCHEDULE_AHEAD_MS)throw Error('Invalid scheduledStartAt');}
  const scheduled=spec.scheduledStartAt??null;
  if(spec.latestStartAt!==undefined&&spec.latestStartAt!==null&&(scheduled==null||!Number.isSafeInteger(spec.latestStartAt)||spec.latestStartAt<scheduled||spec.latestStartAt>scheduled+MAX_SCHEDULE_AHEAD_MS))throw Error('Invalid latestStartAt');
  this.id=spec.id;this.createdAt=now;this.status='lobby';this.tick=0;this.accumulator=0;this.startAt=null;this.raceElapsed=0;this.finishedAt=null;this.lastNow=now;
  this.openRoster=open;this.solo=solo;this.scheduledStartAt=scheduled;
  this.latestStartAt=scheduled==null?null:(spec.latestStartAt??scheduled+DEFAULT_START_WAIT_MS);
  this.config={trackId:spec.trackId,seed:spec.seed,routeVersion:ROUTE_VERSION,physicsVersion:PHYSICS_VERSION,laps,maxSeconds:laps*SECONDS_PER_LAP,format:'combat-race',competitiveCombat:true,...(solo?{solo:true}:{})};
  this.track=createTrack(spec.trackId);this.track.content=generateContent(this.track,spec.seed);
  this.combat=new PlayerCombat(this);
  this.players=new Map(spec.players.map(p=>[p.id,this.makePlayer(p,now)]));
 }
 makePlayer(p,now){const sim=new RaceSimulation(this.track.length,this.track.curvature,{...this.config,content:this.track.content});const player={id:p.id,name:p.name.trim(),sim,ready:false,connected:false,active:false,dnf:false,finishTimeMs:null,lateOffsetMs:0,lastInput:EMPTY_INPUT,lastSeq:-1,lastInputAt:now,frameQueue:[],queuedStep:-1,ackStep:-1,disconnectedAt:now,connection:null,rateAt:now,rateCount:0,combat:{hits:0,kills:0,damageDealt:0,damageTaken:0,collisions:0},lastAttacker:null};const baseUse=sim.useItem.bind(sim);sim.useItem=()=>this.combat.use(player,baseUse);return player;}
 /** CHARTVOLT PATCH. Idempotent: re-adding a registered id returns it unchanged, so a retried launch never errors. */
 addPlayer(p,now=Date.now()){
  if(!this.openRoster)throw Error('Roster is frozen');
  if(!validRosterEntry(p))throw Error('Invalid roster');
  const existing=this.players.get(p.id);if(existing)return existing;
  if(this.status!=='lobby'&&!this.lateEntryOpen())throw Error('Race entry has closed');
  if(this.players.size>=MAX_RACERS)throw Error('Race is full');
  const player=this.makePlayer(p,now);this.players.set(p.id,player);return player;
 }
 /** When an idle lobby may be evicted. A scheduled lobby lives until its latest start plus a margin, not the vendor's flat 30 minutes. */
 lobbyExpiresAt(){return Math.max(this.createdAt+1800000,(this.latestStartAt??this.scheduledStartAt??0)+300000);}
 /** CHARTVOLT PATCH. A scheduled open-roster race keeps its door open until it finishes: a late pilot may still enter, choose and launch. */
 lateEntryOpen(){return this.openRoster&&this.scheduledStartAt!=null&&(this.status==='countdown'||this.status==='racing');}
 /** Whether this player may connect now: before the start, as a racer, or as a late entrant. */
 mayEnter(p){return this.status==='lobby'||p.active||(this.lateEntryOpen()&&!p.dnf);}
 player(id){const p=this.players.get(id);if(!p)throw Error('Player is not registered');return p;}
 join(id,now){const p=this.player(id);if(!this.mayEnter(p))throw Error('Race entry has closed');p.connected=true;p.disconnectedAt=null;p.lastInputAt=now;p.lastInput=EMPTY_INPUT;p.frameQueue=[];return p;}
 disconnect(id,now){const p=this.player(id);p.connected=false;p.disconnectedAt=now;p.lastInput=EMPTY_INPUT;p.frameQueue=[];if(this.status==='lobby')p.ready=false;}
 select(id,shipId){const p=this.player(id);if(p.ready||p.active||(this.status!=='lobby'&&!this.lateEntryOpen()))throw Error('Ship selection is locked');if(!SHIPS.some(s=>s.id===shipId))throw Error('Unknown ship');p.sim.selectShip(shipId);}
 ready(id,ready,now){const p=this.player(id);
  if(this.status!=='lobby'){if(!this.lateEntryOpen()||p.active||p.dnf)throw Error('Race already started');if(!p.connected)throw Error('Connect before ready');if(ready)this.enterLate(p);return;}
  if(!p.connected)throw Error('Connect before ready');p.ready=Boolean(ready);
  // Reason: a scheduled race starts at its appointed moment, never early because everybody happened to be ready.
  if(this.scheduledStartAt==null&&[...this.players.values()].every(p=>p.connected&&p.ready))this.start(now);}
 /**
  * CHARTVOLT PATCH. A pilot who Launches after the start. During the countdown they simply take a grid slot and
  * go green with everyone. After the green light they get a short personal countdown, and the race time already
  * run (plus that countdown) is ADDED to their finishing time - the clock is the race's, not theirs.
  */
 enterLate(p){
  const slot=[...this.players.values()].filter(x=>x.active).length;
  p.ready=true;p.active=true;p.sim.start();p.grid=slot+1;p.sim.lateral=((slot%4)-1.5)*6;p.sim.shield=2;
  if(this.status==='countdown'){p.sim.distance=0-Math.floor(slot/4)*12;p.sim.countdown=Math.max(0,(this.startAt-this.lastNow)/1000);return;}
  p.sim.distance=0;p.sim.countdown=LATE_JOIN_COUNTDOWN_S;p.lateOffsetMs=Math.round((this.raceElapsed+LATE_JOIN_COUNTDOWN_S)*1000);
 }
 /**
  * CHARTVOLT PATCH. The scheduled start (owner decision 28 Sep 2026): nothing happens before scheduledStartAt;
  * from then on, as soon as two connected pilots are Ready, a SCHEDULED_COUNTDOWN_MS countdown starts. If that
  * has not happened by latestStartAt the race is cancelled.
  */
 scheduledTick(now){
  if(this.status!=='lobby'||this.scheduledStartAt==null||now<this.scheduledStartAt)return;
  const ready=[...this.players.values()].filter(p=>p.connected&&p.ready);
  if(ready.length>=2){this.start(now,SCHEDULED_COUNTDOWN_MS);return;}
  if(now>=this.latestStartAt){this.status='cancelled';this.finishedAt=now;this.cancelReason='too-few-ready';}
 }
 start(now,countdownMs=COUNTDOWN_MS){if(this.status!=='lobby')throw Error('Race already started');const racers=[...this.players.values()].filter(p=>p.connected&&p.ready);if(racers.length<(this.solo?1:2))throw Error('At least two connected ready players required');const random=rng(this.config.seed);racers.sort((a,b)=>a.id.localeCompare(b.id));for(let i=racers.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[racers[i],racers[j]]=[racers[j],racers[i]];}this.status='countdown';this.startAt=now+countdownMs;this.lastNow=now;for(const [i,p]of racers.entries()){p.active=true;p.sim.start();p.sim.lateral=racers.length<=4?(i-(racers.length-1)/2)*6:((i%4)-1.5)*6;p.sim.distance=0-Math.floor(i/4)*12;p.grid=i+1;p.sim.countdown=countdownMs/1000;p.sim.shield=2;}}
 input(id,msg,now){const p=this.player(id);if(!p.connected||p.dnf||p.finishTimeMs!=null)return false;if(now-p.rateAt>=1000){p.rateAt=now;p.rateCount=0;}if(++p.rateCount>45)return false;const input=validateInput(msg.input);if(!Number.isSafeInteger(msg.seq)||msg.seq<0||msg.seq<=p.lastSeq||!input)return false;
  // CHARTVOLT PATCH: optional step-numbered frames. A message without them keeps the vendor behaviour exactly.
  let frames=null;if(msg.frames!==undefined){if(!Array.isArray(msg.frames)||msg.frames.length>MAX_FRAMES_PER_MESSAGE)return false;frames=[];for(const raw of msg.frames){const f=decodeFrame(raw);if(!f)return false;frames.push(f);}}
  p.lastSeq=msg.seq;p.lastInputAt=now;
  if(!frames){p.lastInput=input;return true;}
  // Reason: messages are pipelined and repeat every frame the server has not confirmed, so only steps newer than the newest queued one are taken.
  for(const f of frames.sort((a,b)=>a.step-b.step))if(f.step>p.queuedStep){p.frameQueue.push(f);p.queuedStep=f.step;}
  while(p.frameQueue.length>MAX_QUEUED_FRAMES){const dropped=p.frameQueue.shift();if(dropped.input.fire){const next=p.frameQueue[0];p.frameQueue[0]={...next,input:{...next.input,fire:true}};}}
  return true;}
 advance(now){
  const dt=Math.max(0,(now-this.lastNow)/1000);this.lastNow=now;
  if(this.status==='lobby')this.scheduledTick(now);
  if(this.status==='lobby'||this.status==='finished'||this.status==='cancelled')return;
  if(this.status==='countdown'){for(const p of this.players.values())if(p.active)p.sim.countdown=Math.max(0,(this.startAt-now)/1000);if(now<this.startAt)return;this.status='racing';for(const p of this.players.values())if(p.active){p.sim.state='racing';p.sim.countdown=0;}this.accumulator=Math.min(.25,Math.max(0,(now-this.startAt)/1000));}
  else this.accumulator+=Math.min(dt,.25);
  while(this.accumulator>=1/60){this.step(now);this.accumulator-=1/60;}
  // A stall cannot extend the competition's real-world deadline.
  if(now-this.startAt>=this.config.maxSeconds*1000){for(const p of this.players.values())if(p.active&&p.finishTimeMs==null){p.dnf=true;p.sim.finish('time-up');}}
  if([...this.players.values()].filter(p=>p.active).every(p=>p.finishTimeMs!=null||p.dnf)){this.status='finished';this.finishedAt=now;}
 }
 step(now){this.tick++;this.raceElapsed+=1/60;const previous=new Map([...this.players.values()].map(p=>[p.id,{distance:p.sim.distance,lateral:p.sim.lateral}]));for(const p of this.players.values()){
  if(!p.active||p.dnf||p.finishTimeMs!=null)continue;
  if(!p.connected&&now-p.disconnectedAt>30000){p.dnf=true;p.sim.finish('disconnected');continue;}
  // CHARTVOLT PATCH: one queued frame per physics step; with none waiting the vendor hold-then-release rule applies.
  let control;if(p.frameQueue.length){const f=p.frameQueue.shift();p.lastInput=f.input;p.ackStep=f.step;control=f.input;}else control=now-p.lastInputAt>250?EMPTY_INPUT:p.lastInput;
  p.sim.update(1/60,control);
  if(p.sim.state==='finished'){if(p.sim.result().finished)p.finishTimeMs=p.sim.result().timeMs+p.lateOffsetMs;else p.dnf=true;}
 }this.combat.step(1/60,previous);}
 ranked(){return standings([...this.players.values()].filter(p=>this.status==='lobby'||p.active));}
 snapshot(id,now){return{type:'snapshot',protocol:PROTOCOL_VERSION,raceId:this.id,serverTime:now,tick:this.tick,status:this.status,startAt:this.startAt,scheduledStartAt:this.scheduledStartAt,latestStartAt:this.latestStartAt,lateEntry:this.lateEntryOpen(),config:this.config,playerId:id,ack:this.player(id).lastSeq,ackStep:this.player(id).ackStep,inputStep:this.player(id).queuedStep,self:serializeSimulation(this.player(id).sim),combat:this.combat.snapshot(id),standings:this.ranked(),players:[...this.players.values()].filter(p=>p.connected||p.active).map(p=>({id:p.id,name:p.name,shipId:p.sim.shipId,connected:p.connected,ready:p.ready,active:p.active,dnf:p.dnf,finishTimeMs:p.finishTimeMs,distance:p.sim.distance,lateral:p.sim.lateral,heading:p.sim.heading,speed:p.sim.speed,hull:p.sim.hull,shield:p.sim.shield,boosting:p.sim.boosting,respawnRemaining:p.sim.respawnRemaining,respawns:p.sim.respawns})),final:this.isClosed()?this.result():null};}
 /** CHARTVOLT PATCH. A cancelled scheduled race is as final as a finished one: nobody raced, and the receipt must say so. */
 isClosed(){return this.status==='finished'||this.status==='cancelled';}
 result(){return{raceId:this.id,protocol:PROTOCOL_VERSION,config:this.config,authoritative:true,final:this.isClosed(),status:this.status,cancelReason:this.cancelReason??null,scheduledStartAt:this.scheduledStartAt,startedAt:this.startAt,registered:[...this.players.keys()],finishedAt:this.finishedAt,standings:this.ranked(),results:[...this.players.values()].filter(p=>p.active).map(p=>{const r=p.sim.result();
  // Reason: a late pilot's own clock started when they did; the scored time is measured from the race's green light.
  return{playerId:p.id,dnf:p.dnf,combat:{...p.combat},...r,timeMs:r.timeMs+p.lateOffsetMs,lateStartMs:p.lateOffsetMs};})};}
}
