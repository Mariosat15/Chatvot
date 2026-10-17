// CHARTVOLT TEST (14 Oct 2026). Computer pilots in free practice: seated only there, steered only by the server,
// different from each other, and the race still ends on the human.
import test from 'node:test';import assert from 'node:assert/strict';
import {RaceRoom} from '../server/race-room.mjs';
import {aiRoster,MAX_AI_PILOTS} from '../server/ai-pilot.mjs';
import {TRACKS} from '../src/tracks.js';
const pilot={id:'p1',name:'Pilot'};
const practice=(aiPilots,extra={})=>new RaceRoom({id:'practice-ai',trackId:TRACKS[0].id,seed:11,players:[pilot],solo:true,trackChoice:true,aiPilots,...extra},0);

test('bots are refused anywhere but a practice room, and outside 1-15',()=>{
 assert.throws(()=>new RaceRoom({id:'r',trackId:TRACKS[0].id,seed:1,players:[pilot],solo:true,aiPilots:3},0),/practice race/);
 assert.throws(()=>new RaceRoom({id:'r',trackId:TRACKS[0].id,seed:1,players:[pilot,{id:'p2',name:'Two'}],aiPilots:3},0));
 for(const bad of [MAX_AI_PILOTS+1,-1,2.5,'3',true])assert.throws(()=>practice(bad),/practice race/);
 assert.equal(practice(0).players.size,1);assert.equal(practice(undefined).config.aiPilots,undefined);
});

test('a human may not register an id in the bot namespace',()=>{
 assert.throws(()=>new RaceRoom({id:'r',trackId:TRACKS[0].id,seed:1,players:[{id:'ai-1',name:'Spoof'}],solo:true,trackChoice:true},0),/AI prefix/);
});

test('the admin number of bots is seated, ready, flagged and impossible to steer',()=>{
 const r=practice(15);assert.equal(r.players.size,16);assert.equal(r.config.aiPilots,15);
 const bots=[...r.players.values()].filter(p=>p.bot);assert.equal(bots.length,15);
 assert.ok(bots.every(b=>b.connected&&b.ready));
 for(const call of [()=>r.join('ai-1',0),()=>r.ready('ai-1',true,0),()=>r.select('ai-1','comet'),()=>r.input('ai-1',{},0)])assert.throws(call,/not registered/);
 r.join('p1',0);const snap=r.snapshot('p1',0);
 assert.equal(snap.players.filter(p=>p.bot).length,15);assert.equal(snap.players.find(p=>p.id==='p1').bot,undefined);
});

test('bots differ from each other in ship, name and personality',()=>{
 const roster=aiRoster(15,11);
 assert.equal(new Set(roster.map(b=>b.name)).size,15);
 assert.ok(new Set(roster.map(b=>b.shipId)).size>1);
 assert.equal(new Set(roster.map(b=>b.personality.pace.toFixed(4))).size,15);
 assert.deepEqual(aiRoster(15,11),roster,'same seed, same field');
});

test('the human starts the race, bots launch themselves, and the race ends on the human',()=>{
 const r=practice(5);r.join('p1',0);r.ready('p1',true,0);
 assert.equal(r.status,'countdown');
 const human=r.player('p1');let t=0;
 while(r.status==='countdown'&&t<20000){t+=1000/60;r.advance(t);}
 assert.equal(r.status,'racing');
 assert.ok([...r.players.values()].filter(p=>p.bot).every(b=>b.launchThrottle),'every bot pressed Launch');
 for(let i=0;i<60*20;i++){t+=1000/60;r.advance(t);}
 assert.ok([...r.players.values()].filter(p=>p.bot).every(b=>b.sim.distance>100),'bots drive');
 assert.equal(r.status,'racing');
 human.dnf=true;human.sim.finish('disconnected');t+=1000/60;r.advance(t);
 assert.equal(r.status,'finished','bots still racing do not hold the race open');
 assert.ok(r.result().results.some(x=>x.bot&&x.playerId.startsWith('ai-')));
});

test('changing the track keeps every bot ready to drive',()=>{
 const r=practice(3);r.join('p1',0);r.changeTrack('p1',TRACKS[1].id);
 for(const b of [...r.players.values()].filter(p=>p.bot)){assert.equal(b.ai.nextThink,0);assert.equal(b.sim.trackId,TRACKS[1].id);}
});
