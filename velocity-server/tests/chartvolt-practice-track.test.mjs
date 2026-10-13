// CHARTVOLT TEST (13 Oct 2026). A practice pilot may change the circuit from the hangar; nobody else may.
import test from 'node:test';import assert from 'node:assert/strict';
import {RaceRoom} from '../server/race-room.mjs';
import {TRACKS} from '../src/tracks.js';
const pilot={id:'p1',name:'Pilot'};
const practice=(extra={})=>new RaceRoom({id:'practice-a',trackId:TRACKS[0].id,seed:7,players:[pilot],solo:true,trackChoice:true,...extra},0);
const other=TRACKS[1].id;

test('trackChoice is refused on anything but a one-pilot solo room',()=>{
 assert.throws(()=>new RaceRoom({id:'r',trackId:TRACKS[0].id,seed:1,players:[pilot,{id:'p2',name:'Two'}],trackChoice:true},0),/trackChoice requires a solo race/);
 assert.throws(()=>new RaceRoom({id:'r',trackId:TRACKS[0].id,seed:1,players:[],openRoster:true,trackChoice:true},0),/trackChoice requires a solo race/);
});

test('a solo room without trackChoice (a paid each-plays-alone competition) keeps its track',()=>{
 const r=new RaceRoom({id:'r',trackId:TRACKS[0].id,seed:1,players:[pilot],solo:true},0);
 assert.equal(r.config.trackChoice,undefined);
 assert.throws(()=>r.changeTrack('p1',other),/set by the competition/);
 assert.equal(r.config.trackId,TRACKS[0].id);
});

test('a practice pilot changes the track in the lobby and keeps their ship',()=>{
 const r=practice();r.join('p1',0);r.select('p1','comet');
 const config=r.changeTrack('p1',other);
 assert.equal(config.trackId,other);assert.equal(r.config.trackId,other);assert.equal(r.config.trackChoice,true);
 assert.equal(r.track.definition.id,other);
 assert.equal(r.player('p1').sim.shipId,'comet');
 assert.equal(r.player('p1').sim.length,r.track.length);assert.equal(r.player('p1').sim.trackId,other);
 assert.equal(r.snapshot('p1',0).config.trackId,other);
});

test('the track is locked once Launch is pressed, and unknown tracks are refused',()=>{
 const r=practice();r.join('p1',0);
 assert.throws(()=>r.changeTrack('p1','no-such-track'),/Unknown track/);
 r.ready('p1',true,0);
 assert.throws(()=>r.changeTrack('p1',other),/locked/);
 assert.equal(r.config.trackId,TRACKS[0].id);
});
