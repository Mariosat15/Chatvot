// CHARTVOLT TEST (14 Oct 2026). A phone that rotates mid-race can lose its graphics context and reload the
// whole frame; the pilot must still hold their place while it rejoins, and be retired only after the grace.
import test from 'node:test';import assert from 'node:assert/strict';
import {RaceRoom,DISCONNECT_GRACE_MS} from '../server/race-room.mjs';
import {TRACKS} from '../src/tracks.js';

const raceUntilGreen=()=>{
 const r=new RaceRoom({id:'grace',trackId:TRACKS[0].id,seed:7,players:[{id:'p1',name:'One'},{id:'p2',name:'Two'}]},0);
 r.join('p1',0);r.join('p2',0);r.ready('p1',true,0);r.ready('p2',true,0);
 let t=0;while(r.status!=='racing'&&t<30000){t+=1000/60;r.advance(t);}
 assert.equal(r.status,'racing');return {r,t};
};
const run=(r,from,to)=>{let t=from;while(t<to){t+=1000/60;r.advance(t);}return t;};

test('the grace is a minute, long enough for a slow phone to reload and rejoin',()=>{
 assert.equal(DISCONNECT_GRACE_MS,60000);
});

test('a pilot reconnecting inside the grace keeps racing',()=>{
 const {r,t}=raceUntilGreen();r.disconnect('p1',t);
 const later=run(r,t,t+45000);
 assert.equal(r.player('p1').dnf,false,'45s after dropping, the pilot is still in the race');
 r.join('p1',later);run(r,later,later+1000);
 assert.equal(r.player('p1').dnf,false);
});

test('a pilot gone longer than the grace is retired as disconnected',()=>{
 const {r,t}=raceUntilGreen();r.disconnect('p1',t);
 run(r,t,t+DISCONNECT_GRACE_MS+500);
 assert.equal(r.player('p1').dnf,true);
});
