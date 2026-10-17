// CHARTVOLT PATCH (14 Oct 2026, owner: smoother on a weak connection and a slow phone).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RaceRoom} from '../server/race-room.mjs';
import {TRACKS} from '../src/tracks.js';
import {send, SNAPSHOT_BACKLOG_BYTES} from '../server/index.mjs';
import {shedNextEffect, SHED_DETAIL_RANGE} from '../client-patches/frame-shed.js';

const FRAME = 1000 / 60;
function racingRoom() {
  const room = new RaceRoom({id: 'practice-ai', trackId: TRACKS[0].id, seed: 11, players: [{id: 'u1', name: 'Pilot One'}], solo: true, trackChoice: true, aiPilots: 7}, 0);
  room.join('u1', 0);
  room.ready('u1', true, 0);
  return room;
}

test('each combat event is sent once, none is lost, and a fresh connection gets the whole window', () => {
  const room = racingRoom();
  let t = 0, cursor = 0;
  const seen = [];
  for (let i = 0; i < 2400; i++) {
    t += FRAME;
    room.advance(t);
    if (i % 6) continue;
    const s = room.snapshot('u1', t, cursor);
    for (const e of s.combat.events) { seen.push(e.id); cursor = Math.max(cursor, e.id); }
  }
  // The loop can stop between broadcasts; one closing broadcast collects whatever happened since.
  for (const e of room.snapshot('u1', t, cursor).combat.events) { seen.push(e.id); cursor = Math.max(cursor, e.id); }
  assert.ok(seen.length > 0, 'the race produced no events, so this proves nothing');
  assert.equal(new Set(seen).size, seen.length, 'an event was sent twice');
  const window = room.snapshot('u1', t).combat.events.map(e => e.id);
  assert.ok(window.length > 0);
  for (const id of window) assert.ok(seen.includes(id), `event ${id} never reached the cursor stream`);
  assert.equal(room.snapshot('u1', t, cursor).combat.events.length, 0);
});

test('rivals travel rounded and the player\'s own ship is never rounded', () => {
  const room = racingRoom();
  let t = 0;
  for (let i = 0; i < 1200; i++) { t += FRAME; room.advance(t); }
  const s = room.snapshot('u1', t);
  const decimals = n => (String(n).split('.')[1] || '').length;
  for (const p of s.players) {
    assert.ok(decimals(p.distance) <= 2 && decimals(p.lateral) <= 2 && decimals(p.speed) <= 2, `${p.id} not rounded`);
    assert.ok(decimals(p.heading) <= 4, `${p.id} heading not rounded`);
  }
  for (const r of s.standings) assert.ok(decimals(r.distance) <= 2);
  const me = room.players.get('u1').sim;
  assert.equal(s.self.distance ?? s.self.sim?.distance ?? me.distance, me.distance);
});

test('send() advances the connection cursor past what it wrote', () => {
  const room = racingRoom();
  let t = 0;
  for (let i = 0; i < 2400; i++) { t += FRAME; room.advance(t); }
  const written = [];
  const p = {id: 'u1', connection: {res: {write: d => written.push(d)}, eventCursor: 0}};
  send(room, p, t);
  const first = JSON.parse(written[0].slice(6));
  assert.ok(first.combat.events.length > 0);
  assert.equal(p.connection.eventCursor, Math.max(...first.combat.events.map(e => e.id)));
  send(room, p, t);
  assert.equal(JSON.parse(written[1].slice(6)).combat.events.length, 0);
});

test('a connection with an update still queued is skipped, not stacked', () => {
  const code = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const skip = code.indexOf('res.writableLength>SNAPSHOT_BACKLOG_BYTES)continue;');
  const write = code.indexOf('send(room,p,now);}', skip);
  assert.ok(skip > 0 && write > skip, 'the backlog skip must sit in front of the broadcast write');
  assert.ok(SNAPSHOT_BACKLOG_BYTES < 256 * 1024);
});

test('the slow-phone fallback drops glow, then clouds, then distant detail, then stops', () => {
  const view = {bloom: {enabled: true}, cloudVolume: {visible: true}, cloudDetails: [{visible: true}, {visible: true}], detailRange: 350, dynamicScale: .75};
  assert.deepEqual([shedNextEffect(view), shedNextEffect(view), shedNextEffect(view), shedNextEffect(view)], ['bloom', 'clouds', 'detail', null]);
  assert.equal(view.bloom.enabled, false);
  assert.equal(view.cloudVolume.visible, false);
  assert.ok(view.cloudDetails.every(c => !c.visible));
  assert.equal(view.detailRange, SHED_DETAIL_RANGE);
  assert.equal(view.dynamicScale, .75, 'resolution belongs to the first stage');
  const phone = {bloom: {enabled: false}, cloudVolume: {visible: false}, cloudDetails: [], detailRange: 100};
  assert.equal(shedNextEffect(phone), null, 'never raises a range already below the floor');
  assert.equal(phone.detailRange, 100);
});

test('the scene only reaches for the fallback when the scale is already at its floor', () => {
  const code = readFileSync(new URL('../client-patches/scene.js', import.meta.url), 'utf8');
  assert.match(code, /import \{shedNextEffect\} from '\.\/frame-shed\.js';/);
  assert.match(code, /else \/\*[^*]*\*\/this\.scaleCooldown=this\.frameCost>21&&shedNextEffect\(this\)\?180:30;\}\}/);
});
