import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createRaceServer} from '../server/index.mjs';import {issueTicket} from '../server/tickets.mjs';
test('two real HTTP streams receive common progress and standings; auth and origin gates reject attacks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'volt-net-')),secret='ticket-secret-'.repeat(4),adminKey='admin-secret-'.repeat(4),app=await createRaceServer({secret,adminKey,origins:['https://chartvolt.test'],dataDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const controllers=[];async function request(path,token,body,method='POST',origin){return fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})});}
 try{
  const spec={id:'real-race',trackId:'orbital',seed:77,players:[{id:'a',name:'Alpha'},{id:'b',name:'Bravo'}]};
  assert.equal((await request('/v1/races','bad',spec)).status,401);assert.equal((await request('/v1/races',adminKey,spec,'POST','https://evil.test')).status,403);assert.equal((await request('/v1/races',adminKey,spec)).status,201);
  const tickets=['a','b'].map(playerId=>issueTicket({aud:'volt-velocity',raceId:'real-race',playerId,exp:Math.floor(Date.now()/1000)+600},secret));
  const streams=await Promise.all(tickets.map(async ticket=>{const c=new AbortController();controllers.push(c);const response=await fetch(base+'/v1/races/real-race/events',{headers:{Authorization:'Bearer '+ticket},signal:c.signal});assert.equal(response.status,200);return response.body.getReader();}));
  for(const [i,reader]of streams.entries()){const {value}=await reader.read();const s=JSON.parse(new TextDecoder().decode(value).split('\n\n')[0].slice(6));assert.equal(s.playerId,i?'b':'a');assert.equal(s.config.seed,77);}
  assert.equal((await request('/v1/races/real-race/ship',tickets[0],{shipId:'comet'})).status,200);
  for(const t of tickets)assert.equal((await request('/v1/races/real-race/ready',t,{ready:true})).status,200);
  const room=app.rooms.get('real-race');assert.equal(room.status,'countdown');assert.equal((await request('/v1/races/real-race/ship',tickets[0],{shipId:'bastion'})).status,400);
  const input={seq:1,input:{steer:0,throttle:true,brake:false,boost:false,fire:false},distance:1e9};assert.equal((await request('/v1/races/real-race/input',tickets[0],input)).status,200);assert.equal((await request('/v1/races/real-race/input',tickets[0],input)).status,409);
  assert.equal(room.player('a').sim.distance,0);room.startAt=Date.now()-10;await new Promise(r=>setTimeout(r,140));assert.ok(room.player('a').sim.distance>0);assert.equal(room.ranked()[0].id,'a');
  const outsider=issueTicket({aud:'volt-velocity',raceId:'real-race',playerId:'intruder',exp:Math.floor(Date.now()/1000)+600},secret);assert.equal((await request('/v1/races/real-race/join',outsider,{})).status,403);
  assert.equal((await request('/v1/races/real-race/result',tickets[0],undefined,'GET')).status,401);
  room.advance(room.startAt+301000);const res=await request('/v1/races/real-race/result',adminKey,undefined,'GET');assert.equal(res.status,200);const result=await res.json();assert.equal(result.final,true);assert.equal(result.resultId,'volt-velocity:real-race');assert.equal(typeof result.signature,'string');
  assert.equal((await request('/v1/races',adminKey,spec)).status,409);
 }finally{for(const c of controllers)c.abort();await app.close();await rm(dir,{recursive:true,force:true});}
});
