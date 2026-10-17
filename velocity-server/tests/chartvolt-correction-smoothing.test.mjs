// CHARTVOLT PATCH test (14 Oct 2026, owner: "in cockpit on desktop my ship was jumping from one place
// to another when near to finish the time"). See client-patches/correction-smoothing.js.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {easesCorrection,SMOOTH_LIMITS} from '../client-patches/correction-smoothing.js';
import {RaceRoom} from '../server/race-room.mjs';
import {RaceSimulation} from '../src/simulation.js';
import {restoreSimulation} from '../src/multiplayer-state.js';
import {quantizeInput,encodeFrame} from '../src/input-frames.js';
import {createTrack} from '../src/track.js';import {generateContent} from '../src/race-content.js';

const racing={state:'racing',respawn:0},finished={state:'finished',respawn:0},small={distance:-6,lateral:.2,heading:.01};

test('small corrections are eased while racing and into the finish',()=>{
 assert.equal(easesCorrection(racing,racing,small),true);
 assert.equal(easesCorrection(racing,finished,small),true,'time-up correction must not teleport');
 assert.equal(easesCorrection(finished,finished,small),true);
 assert.equal(easesCorrection(racing,racing,{distance:-30,lateral:0,heading:0}),true,'a stall-sized correction is eased');
});

test('real jumps are still adopted at once',()=>{
 assert.equal(easesCorrection({state:'countdown',respawn:0},racing,small),false);
 assert.equal(easesCorrection(racing,{state:'hangar',respawn:0},small),false);
 assert.equal(easesCorrection({state:'racing',respawn:1},racing,small),false);
 assert.equal(easesCorrection(racing,{state:'racing',respawn:2},small),false);
 for(const axis of ['distance','lateral','heading'])assert.equal(easesCorrection(racing,racing,{...small,[axis]:SMOOTH_LIMITS[axis]}),false,axis+' at its limit');
 assert.equal(easesCorrection(racing,racing,{...small,distance:NaN}),false);
});

test('main.js decides through the shared rule, not its own copy',()=>{
 const src=readFileSync(new URL('../client-patches/main.js',import.meta.url),'utf8');
 assert.match(src,/import \{easesCorrection\} from '\.\/correction-smoothing\.js'/);
 assert.match(src,/if\(easesCorrection\(before,\{state:sim\.state,respawn:sim\.respawnRemaining\},\{distance:dd,lateral:dl,heading:dh\}\)\)\{smoothing\.distance\+=dd;/);
 assert.doesNotMatch(src,/Math\.abs\(dd\)<25/);
});

// Fake-clock race: the real room and simulation, a client predicting with numbered frames, 40-70 ms
// each way, and a server that stalls for 0.6 s mid-race. Deterministic, so no timing flake.
function runStalledRace(stallMs){
 const LIMIT=20;let seed=3;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const room=new RaceRoom({id:'r',trackId:'orbital',seed:123,players:[{id:'a',name:'A'},{id:'b',name:'B'}]},0);
 room.config.maxSeconds=LIMIT;for(const p of room.players.values())p.sim.maxTime=LIMIT;
 for(const id of ['a','b']){room.join(id,0);room.ready(id,true,0);}
 const track=createTrack('orbital');track.content=generateContent(track,123);
 const sim=new RaceSimulation(track.length,track.curvature,{...room.config,content:track.content});
 const queue=[],at=(t,f)=>queue.push({t,f}),corrections=[];
 let frames=[],nextStep=null,inputStep=null,seq=1,snap=null,serverNext=0,clientNext=0,sendNext=0,broadcastNext=0;
 const onSnap=s=>{snap=s;if(nextStep==null){restoreSimulation(sim,s.self);return;}
  const before={state:sim.state,distance:sim.distance,respawn:sim.respawnRemaining};
  if(before.state==='racing'&&s.self.state==='countdown'&&Number(s.self.countdown)<1.5)return;
  restoreSimulation(sim,s.self);
  frames=frames.filter(f=>f.step>s.ackStep);
  if(s.self.state==='racing'&&frames.length<=180)for(const f of frames){if(sim.state!=='racing')break;sim.update(1/60,f.input);}
  sim.events=[];
  const dd=before.distance-sim.distance;
  if(Math.abs(dd)>0.01&&before.state!=='countdown')corrections.push({before,after:{state:sim.state,respawn:sim.respawnRemaining},delta:{distance:dd,lateral:0,heading:0}});};
 for(let now=0;now<(LIMIT+8)*1000;now+=.25){
  queue.sort((x,y)=>x.t-y.t);while(queue.length&&queue[0].t<=now)queue.shift().f();
  if(now>=12000&&now<12000+stallMs){serverNext=Math.max(serverNext,now);continue;}
  if(now>=serverNext){room.advance(Math.round(now));serverNext+=1000/60+(rnd()-.5)*6;
   if(now>=broadcastNext){broadcastNext+=100;const s=JSON.parse(JSON.stringify(room.snapshot('a',Math.round(now))));at(now+40+rnd()*30,()=>{if(!snap||s.tick>=snap.tick)onSnap(s);});}}
  if(now>=clientNext){clientNext+=1000/60;if(snap){if(nextStep==null){nextStep=snap.inputStep+1;inputStep=snap.inputStep;}
   if(snap.self.state==='racing'&&sim.state==='racing'){const fr=quantizeInput(nextStep++,{steer:Math.sin(now/600)*.5,throttle:true,brake:false,boost:false,fire:false});frames.push(fr);sim.update(1/60,fr.input);sim.events=[];}}}
  if(now>=sendNext){sendNext+=50;const unsent=frames.filter(f=>f.step>inputStep).slice(-30);
   if(unsent.length){const msg={seq:seq++,input:unsent.at(-1).input,frames:unsent.map(f=>encodeFrame(f.step,f.input))},d1=40+rnd()*30,d2=40+rnd()*30;
    at(now+d1,()=>{room.input('a',msg,Math.round(now+d1));const queued=room.player('a').queuedStep;at(now+d1+d2,()=>{if(queued>inputStep)inputStep=queued;});});}}
 }
 return corrections;
}

test('after a server stall the time-up and stall corrections are eased, not teleported',()=>{
 const corrections=runStalledRace(600);
 const end=corrections.filter(c=>c.after.state==='finished');
 assert.ok(end.length>=1,'the stalled server must end the race short of the prediction');
 assert.ok(end.some(c=>Math.abs(c.delta.distance)>5),'the time-up correction is metres, not centimetres');
 assert.ok(corrections.some(c=>Math.abs(c.delta.distance)>=25),'the stall itself produces a correction the old 25 m rule snapped');
 for(const c of corrections)assert.equal(easesCorrection(c.before,c.after,c.delta),true,JSON.stringify(c));
});

test('without a stall the prediction agrees with the server to the end',()=>{
 for(const c of runStalledRace(0))assert.ok(Math.abs(c.delta.distance)<2,JSON.stringify(c));
});
