// CHARTVOLT PATCH test. Drives the REAL patched browser network client (client-patches/) against
// the REAL race server over HTTP, running the same predict-then-reconcile loop main.js runs, and
// measures how far each server snapshot disagrees with the ship the player was being shown.
// Reason: the two sides were each proven deterministic in isolation (chartvolt-input-frames);
// this is the only test that would notice them disagreeing about step numbers on the wire.
// Probed red by a client that sends only every other step (0.54 m median correction). Knowingly
// NOT caught: a server labelling its acknowledgement a constant N steps early. The client then
// replays N extra frames every time, i.e. runs a steady N/60 s ahead, which neither jitters nor
// drifts - it is indistinguishable from prediction working, and harmless for the same reason.
// The reconcile loop below restates main.js's, because main.js is a browser module (DOM, WebGL).
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,copyFile,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,dirname} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRaceServer} from '../server/index.mjs';import {issueTicket} from '../server/tickets.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));

// The patched client imports its siblings relatively, so it is assembled beside the shared
// simulation sources in a scratch directory exactly as the vendor build lays them out.
async function loadClientModules(){
 // Inside the package, not the OS temp dir, so the copies resolve `three` from its node_modules.
 const dir=await mkdtemp(join(root,'.client-test-'));
 for(const f of await readdir(join(root,'src')))if(f.endsWith('.js'))await copyFile(join(root,'src',f),join(dir,f));
 await copyFile(join(root,'client-patches','multiplayer-client.js'),join(dir,'multiplayer-client.js'));
 const load=f=>import(pathToFileURL(join(dir,f)).href);
 const [{MultiplayerClient},{RaceSimulation},{restoreSimulation},{createTrack},{generateContent}]=await Promise.all(['multiplayer-client.js','simulation.js','multiplayer-state.js','track.js','race-content.js'].map(load));
 return {dir,MultiplayerClient,RaceSimulation,restoreSimulation,createTrack,generateContent};
}

test('patched client predicts its own ship and the server agrees within centimetres',{timeout:30000},async()=>{
 const m=await loadClientModules();
 const dataDir=await mkdtemp(join(tmpdir(),'volt-pred-')),secret='ticket-secret-'.repeat(4),adminKey='admin-secret-'.repeat(4);
 const app=await createRaceServer({secret,adminKey,origins:['https://chartvolt.test'],dataDir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port,clients=[];let loop;
 try{
  const spec={id:'pred-race',trackId:'orbital',seed:91,players:[{id:'a',name:'Alpha'},{id:'b',name:'Bravo'}]};
  const created=await fetch(base+'/v1/races',{method:'POST',headers:{Authorization:'Bearer '+adminKey,'Content-Type':'application/json'},body:JSON.stringify(spec)});assert.equal(created.status,201);
  const ticket=playerId=>issueTicket({aud:'volt-velocity',raceId:'pred-race',playerId,exp:Math.floor(Date.now()/1000)+600},secret);

  let sim=null;const errors=[],bias=[],predicted=new Map();let lastAck=-1,replayed=0,snapshots=0;
  const a=new m.MultiplayerClient({url:base,ticket:ticket('a'),raceId:'pred-race',onStatus(){},onSnapshot(s){
   if(!sim){const track=m.createTrack(s.config.trackId);track.content=m.generateContent(track,s.config.seed);sim=new m.RaceSimulation(track.length,track.curvature,{...s.config,content:track.content});}
   // Reason: a replay that is off by one step shifts the ship by the same amount at EVERY snapshot,
   // so the snapshot-to-snapshot correction below stays at zero. Comparing what this client predicted
   // for the acknowledged step with where the server actually put the ship catches that bias.
   const guess=predicted.get(s.ackStep);if(guess&&s.self.state==='racing')bias.push(Math.hypot(s.self.distance-guess.distance,s.self.lateral-guess.lateral));
   const before={state:sim.state,distance:sim.distance,lateral:sim.lateral};
   m.restoreSimulation(sim,s.self);
   if(Number.isSafeInteger(s.ackStep)&&sim.state==='racing'){const pending=a.pendingFrames(s.ackStep);replayed+=pending.length;for(const f of pending)sim.update(1/60,f.input);sim.events=[];lastAck=s.ackStep;}
   if(before.state==='racing'&&sim.state==='racing'){snapshots++;errors.push(Math.hypot(sim.distance-before.distance,sim.lateral-before.lateral));}
  }});
  const b=new m.MultiplayerClient({url:base,ticket:ticket('b'),raceId:'pred-race',onStatus(){},onSnapshot(){}});
  clients.push(a,b);
  await a.connect();await b.connect();assert.equal(a.framed,true,'patched server must be detected as step-framed');
  await a.request('ready',{ready:true});await b.request('ready',{ready:true});

  // The main.js fixed-step loop: one recorded frame per 1/60 s while racing.
  let acc=0,last=performance.now(),t=0;
  loop=setInterval(()=>{const now=performance.now();acc+=Math.min(.25,(now-last)/1000);last=now;while(acc>=1/60){acc-=1/60;t+=1/60;
   if(sim?.state==='racing'){const frame=a.record({steer:Math.sin(t*1.7)*.6,throttle:true,brake:false,boost:t%3<.5,fire:false});sim.update(1/60,frame.input);a.input(frame.input);predicted.set(frame.step,{distance:sim.distance,lateral:sim.lateral});}}},4);

  const deadline=Date.now()+20000;while(Date.now()<deadline&&!(snapshots>=25&&sim?.distance>40))await new Promise(r=>setTimeout(r,100));
  assert.ok(snapshots>=25,'expected at least 25 racing snapshots, got '+snapshots);
  assert.ok(sim.distance>40,'the ship must actually have driven, got '+sim.distance);
  assert.ok(lastAck>100,'the server must be acknowledging recorded steps, got '+lastAck);
  assert.ok(replayed>0,'reconciliation must replay unacknowledged frames');
  errors.sort((x,y)=>x-y);const median=errors[Math.floor(errors.length/2)];
  // Reason: a prediction that disagreed with the server by a whole step at speed is ~0.5 m, which
  // is the back-and-forth snap the owner reported. The median, not the maximum, is asserted
  // because a snapshot racing a timer tick can legitimately land one frame out on a busy CI box.
  assert.ok(median<.05,'median correction per snapshot was '+median.toFixed(3)+' m');
  assert.ok(bias.length>=20,'expected acknowledged steps to compare, got '+bias.length);bias.sort((x,y)=>x-y);
  const biasMedian=bias[Math.floor(bias.length/2)];assert.ok(biasMedian<.05,'median server-vs-prediction gap at the acknowledged step was '+biasMedian.toFixed(3)+' m');
 }finally{clearInterval(loop);for(const c of clients)c.close();await app.close();await rm(dataDir,{recursive:true,force:true});await rm(m.dir,{recursive:true,force:true});}
});
