import test from 'node:test';
import assert from 'node:assert/strict';
import {ROAD_SCALE,ROAD_HALF_WIDTH,DRIVE_LIMIT} from '../src/road-width.js';
import {gridSlot,GRID_SLOTS,GRID_COLUMNS,GRID_ROW_SPACING,GRID_LANE_SPACING,GRID_STAGGER} from '../src/start-grid.js';
import {HALF_WIDTH,createTrack} from '../src/track.js';
import {TRACKS} from '../src/tracks.js';
import {generateContent} from '../src/race-content.js';
import {RaceRoom} from '../server/race-room.mjs';

// CHARTVOLT PATCH (owner, 28 Sep 2026: "make the road larger as if we have 16 players not
// going to fit, also have a pole position like F1 has, like 3 ships each position").
// Reason: the road width now lives in one module and the grid in one function; these
// tests pin that every consumer agrees with them, so a later edit to either cannot put a
// ship, a pickup or a service lane outside the drivable road.

test('the road is wider and the track, drive limit and constants agree',()=>{
  assert.ok(ROAD_SCALE>1);
  assert.equal(HALF_WIDTH,ROAD_HALF_WIDTH);
  assert.ok(DRIVE_LIMIT<ROAD_HALF_WIDTH);
});

test('a full 16-ship grid is 2 per row, F1-staggered, rows behind the line, unique and inside the road',()=>{
  assert.equal(GRID_SLOTS,16);assert.equal(GRID_COLUMNS,2);
  const slots=Array.from({length:GRID_SLOTS},(_,i)=>gridSlot(i,GRID_SLOTS));
  const key=s=>`${s.distance}|${s.lateral}`;
  assert.equal(new Set(slots.map(key)).size,GRID_SLOTS);
  for(const s of slots){
    assert.ok(Math.abs(s.lateral)<DRIVE_LIMIT,'slot inside the drivable road');
    assert.ok(s.distance<=0,'nobody starts past the line');
    assert.ok(s.column<GRID_COLUMNS);
  }
  const rows=new Map();for(const s of slots)rows.set(s.row,(rows.get(s.row)??0)+1);
  for(const [row,count] of rows)assert.ok(count<=GRID_COLUMNS,`row ${row} has ${count}`);
  assert.equal(slots[0].distance,0,'pole sits on the line');
  assert.ok(Object.is(slots[0].distance,0)&&Object.is(slots[0].lateral+0,slots[0].lateral),'no negative zero on pole');
  assert.equal(slots[1].distance,-GRID_STAGGER,'P2 is alongside, one stagger back');
  assert.ok(slots[0].lateral<0&&slots[1].lateral>0,'P1 and P2 take opposite columns');
  assert.equal(slots[2].distance,-GRID_ROW_SPACING,'P3 is one full row behind pole, same column');
  // Reason: the F1 rule the leaderboard order relies on - every slot is strictly behind the one before it.
  for(let i=1;i<slots.length;i++)assert.ok(slots[i].distance<slots[i-1].distance,`slot ${i} is behind slot ${i-1}`);
});

test('ships on the grid never overlap: every pair keeps clear distance',()=>{
  const slots=Array.from({length:GRID_SLOTS},(_,i)=>gridSlot(i,GRID_SLOTS));
  for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){
    const d=Math.hypot(slots[i].distance-slots[j].distance,slots[i].lateral-slots[j].lateral);
    assert.ok(d>=Math.min(GRID_LANE_SPACING,GRID_ROW_SPACING)-1e-9,`slots ${i} and ${j} are ${d.toFixed(2)} m apart`);
  }
});

test('a lone ship in the last row keeps its F1 box, and a late joiner gets the same slot',()=>{
  // Reason (13 Oct 2026): the three-abreast grid centred a short last row; a staggered grid keeps the box, as F1 does.
  assert.deepEqual(gridSlot(2,3),gridSlot(2,GRID_SLOTS));
  assert.deepEqual(gridSlot(4),gridSlot(4,GRID_SLOTS));
});

test('every track keeps pickups, pads, gates and service lanes inside the wider road',()=>{
  for(const def of TRACKS)for(const seed of [0,1,999]){
    const c=generateContent(createTrack(def.id),seed);
    for(const p of c.pickups)assert.ok(Math.abs(p.lane)<=8*ROAD_SCALE+1e-9,`${def.id} pickup`);
    for(const p of c.pads)assert.ok(Math.abs(p.lane)<DRIVE_LIMIT,`${def.id} pad`);
    for(const g of c.gates??[])assert.ok(Math.abs(g.lane)<DRIVE_LIMIT,`${def.id} gate`);
    for(const s of c.service)assert.ok(Math.abs(s.lane)+2.5<DRIVE_LIMIT,`${def.id} service`);
    for(const h of c.hazards)assert.ok(Math.abs(h.lane)>ROAD_HALF_WIDTH,`${def.id} turret stays off the road`);
  }
});

test('the race room seats 16 players and places each on its own grid slot',()=>{
  const players=Array.from({length:GRID_SLOTS},(_,i)=>({id:`p${i}`,name:`Pilot ${i}`}));
  const room=new RaceRoom({id:'grid',trackId:'orbital',seed:7,players},0);
  for(const p of room.players.values()){room.join(p.id,0);room.ready(p.id,true,0);}
  assert.equal(room.status,'countdown');
  const racers=[...room.players.values()];
  assert.equal(racers.length,GRID_SLOTS);
  const seats=racers.map(p=>`${p.sim.distance}|${p.sim.lateral}`);
  assert.equal(new Set(seats).size,GRID_SLOTS,'every pilot has their own grid box');
  const expected=new Set(Array.from({length:GRID_SLOTS},(_,i)=>{const s=gridSlot(i,GRID_SLOTS);return `${s.distance}|${s.lateral}`;}));
  for(const s of seats)assert.ok(expected.has(s),`seat ${s} is a painted grid box`);
});
