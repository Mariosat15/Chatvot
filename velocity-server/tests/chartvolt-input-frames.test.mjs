// CHARTVOLT PATCH tests: step-numbered input frames (see CHARTVOLT-PATCHES.md).
import test from 'node:test';import assert from 'node:assert/strict';
import {RaceRoom,MAX_QUEUED_FRAMES} from '../server/race-room.mjs';
import {serializeSimulation,restoreSimulation} from '../src/multiplayer-state.js';
import {RaceSimulation} from '../src/simulation.js';
import {encodeFrame,decodeFrame,quantizeInput,MAX_FRAMES_PER_MESSAGE} from '../src/input-frames.js';

const spec={id:'frames',trackId:'orbital',seed:123,players:[{id:'alice',name:'Alice'},{id:'bob',name:'Bob'}]};
const drive={steer:0,throttle:true,brake:false,boost:false,fire:false};
function started(){const r=new RaceRoom(spec,0);for(const p of spec.players){r.join(p.id,0);r.ready(p.id,true,0);}r.advance(5000);r.player('bob').sim.distance=900;return r;}
const tickAt=(r,i)=>r.advance(5000+Math.ceil(i*1000/60)+1);

test('frame codec round-trips and quantises steer to the value both sides simulate with',()=>{
 const f=quantizeInput(7,{steer:.12345,throttle:true,brake:false,boost:true,fire:true});
 assert.deepEqual(f,{step:7,input:{steer:.123,throttle:true,brake:false,boost:true,fire:true}});
 assert.deepEqual(decodeFrame(encodeFrame(7,f.input)),f);
 for(const bad of [null,[1,2],[-1,0,0],[1.5,0,0],[1,1001,0],[1,0,16],[1,0,-1],['1',0,0]])assert.equal(decodeFrame(bad),null);
});

test('the server applies exactly one frame per step and a client replaying the same frames lands on the same state',()=>{
 const r=started(),alice=r.player('alice');
 const client=new RaceSimulation(r.track.length,r.track.curvature,{...r.config,content:r.track.content});
 restoreSimulation(client,serializeSimulation(alice.sim));
 const frames=[];for(let i=0;i<24;i++)frames.push(quantizeInput(i,{...drive,steer:Math.sin(i/5)*.8,boost:i>10}));
 for(const f of frames)client.update(1/60,f.input);
 assert.equal(r.input('alice',{seq:1,input:drive,frames:frames.map(f=>encodeFrame(f.step,f.input))},5000),true);
 assert.equal(alice.frameQueue.length,MAX_QUEUED_FRAMES);
 const early=r.snapshot('alice',5000);assert.equal(early.inputStep,23);assert.equal(early.ackStep,-1);
 // Reason: the queue bound dropped the oldest frames, so compare against a client that also skipped them.
 const kept=frames.slice(-MAX_QUEUED_FRAMES);const replay=new RaceSimulation(r.track.length,r.track.curvature,{...r.config,content:r.track.content});
 restoreSimulation(replay,serializeSimulation(alice.sim));for(const f of kept)replay.update(1/60,f.input);
 for(let i=1;i<=MAX_QUEUED_FRAMES;i++)tickAt(r,i);
 assert.equal(r.snapshot('alice',6000).ackStep,23);
 for(const k of ['distance','lateral','heading','speed','lateralVelocity','energy'])assert.equal(alice.sim[k],replay[k],k);
 assert.ok(client.distance>0);
});

test('a small batch is applied step for step with no drift from the prediction',()=>{
 const r=started(),alice=r.player('alice');
 const client=new RaceSimulation(r.track.length,r.track.curvature,{...r.config,content:r.track.content});
 restoreSimulation(client,serializeSimulation(alice.sim));
 const frames=[0,1,2,3,4].map(i=>quantizeInput(i,{...drive,steer:-.4}));for(const f of frames)client.update(1/60,f.input);
 r.input('alice',{seq:1,input:drive,frames:frames.map(f=>encodeFrame(f.step,f.input))},5000);
 for(let i=1;i<=5;i++)tickAt(r,i);
 assert.equal(r.snapshot('alice',6000).ackStep,4);
 for(const k of ['distance','lateral','heading','speed'])assert.equal(alice.sim[k],client[k],k);
});

test('repeated and older frames are ignored, so pipelined messages never apply a step twice',()=>{
 const r=started(),alice=r.player('alice');
 const enc=steps=>steps.map(s=>encodeFrame(s,drive));
 r.input('alice',{seq:1,input:drive,frames:enc([0,1,2])},5000);
 r.input('alice',{seq:2,input:drive,frames:enc([1,2,3,4])},5010);
 assert.deepEqual(alice.frameQueue.map(f=>f.step),[0,1,2,3,4]);
 assert.equal(r.input('alice',{seq:2,input:drive,frames:enc([5])},5020),false,'a replayed seq is still refused');
});

test('a dropped frame hands its fire press to the next one',()=>{
 const r=started(),alice=r.player('alice');
 const frames=Array.from({length:MAX_QUEUED_FRAMES+1},(_,i)=>encodeFrame(i,{...drive,fire:i===0}));
 r.input('alice',{seq:1,input:drive,frames},5000);
 assert.equal(alice.frameQueue.length,MAX_QUEUED_FRAMES);assert.equal(alice.frameQueue[0].step,1);assert.equal(alice.frameQueue[0].input.fire,true);
});

test('a malformed frame refuses the whole message and consumes nothing',()=>{
 const r=started(),alice=r.player('alice');
 assert.equal(r.input('alice',{seq:1,input:drive,frames:[encodeFrame(0,drive),[1,5000,0]]},5000),false);
 assert.equal(r.input('alice',{seq:2,input:drive,frames:'x'},5000),false);
 assert.equal(r.input('alice',{seq:3,input:drive,frames:Array.from({length:MAX_FRAMES_PER_MESSAGE+1},(_,i)=>encodeFrame(i,drive))},5000),false);
 assert.equal(alice.lastSeq,-1);assert.equal(alice.frameQueue.length,0);
});

test('with the queue empty the vendor hold-then-release rule still applies, and a reconnect discards stale frames',()=>{
 const r=started(),alice=r.player('alice');
 r.input('alice',{seq:1,input:drive,frames:[encodeFrame(0,drive)]},5000);
 tickAt(r,1);assert.equal(alice.sim.throttle,true);
 r.advance(5100);assert.equal(alice.sim.throttle,true,'held for under 250 ms');
 r.advance(5400);assert.equal(alice.sim.throttle,false,'released after 250 ms');
 r.input('alice',{seq:2,input:drive,frames:[encodeFrame(1,drive),encodeFrame(2,drive)]},5400);
 r.disconnect('alice',5401);r.join('alice',5402);
 assert.equal(alice.frameQueue.length,0);assert.equal(r.snapshot('alice',5402).inputStep,2,'the client resumes numbering after the last step the server saw');
});
