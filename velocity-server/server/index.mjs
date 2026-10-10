import http from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {RaceRoom} from './race-room.mjs';
import {verifyTicket} from './tickets.mjs';
import {raceEnvironment} from './env.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function equal(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
// CHARTVOLT PATCH: defaults come from games-service/.env (see env.mjs), not RACE_* / PORT / HOST.
export async function createRaceServer({secret=raceEnvironment(process.env,root).secret,adminKey=raceEnvironment(process.env,root).adminKey,origins=raceEnvironment(process.env,root).origins,dataDir=raceEnvironment(process.env,root).dataDir}={}){
 if(!secret||secret.length<32||!adminKey||adminKey.length<32)throw Error('Set separate VELOCITY_TICKET_SECRET and VELOCITY_ADMIN_KEY in games-service/.env (at least 32 characters each)');if(secret===adminKey)throw Error('Use separate ticket and admin secrets');
 await mkdir(dataDir,{recursive:true,mode:0o700});const rooms=new Map(),saved=new Set(),saving=new Map();
 // CHARTVOLT PATCH: a cancelled scheduled race is archived too, or its result endpoint answers 202 for ever and nothing can settle it.
 async function archive(room){if(!room.isClosed()||saved.has(room.id))return;if(saving.has(room.id))return saving.get(room.id);const pending=(async()=>{try{const result=room.result(),payload=JSON.stringify(result),receipt={...result,resultId:`volt-velocity:${room.id}`,signature:createHmac('sha256',secret).update(payload).digest('hex'),signedPayload:payload};await writeFile(resolve(dataDir,room.id+'.json.pending'),JSON.stringify(receipt),{mode:0o600});await rename(resolve(dataDir,room.id+'.json.pending'),resolve(dataDir,room.id+'.json'));saved.add(room.id);}catch(e){console.error('Race result archive failed:',e.message)}finally{saving.delete(room.id)}})();saving.set(room.id,pending);return pending;}
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;if(origin&&!origins.includes(origin)){res.writeHead(403).end('Origin not allowed');return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
  function json(status,data){res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(data));}
  async function body(){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)throw Error('Request too large');}return JSON.parse(text||'{}');}
  try{
   const url=new URL(req.url,'http://localhost'),parts=url.pathname.split('/').filter(Boolean),bearer=/^Bearer (.+)$/.exec(req.headers.authorization||'')?.[1];
   if(req.method==='GET'&&url.pathname==='/health'){json(200,{ok:true,rooms:rooms.size});return;}
   // CHARTVOLT PATCH: the vendor `GET /` served dist/Volt-Velocity-3D.html. Removed - games-service serves the client
   // from VELOCITY_CLIENT_DIR behind a play token; this process only speaks the race protocol.
   if(req.method==='POST'&&url.pathname==='/v1/races'){
    if(!equal(bearer,adminKey)){json(401,{error:'Admin authentication required'});return;}
    const spec=await body();if(rooms.size>=100){json(503,{error:'Race capacity reached'});return;}const room=new RaceRoom(spec);
    let exists=false;try{await readFile(resolve(dataDir,room.id+'.json'));exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
    if(rooms.has(room.id)||exists){json(409,{error:'Race ID already exists; use a new competition race ID'});return;}rooms.set(room.id,room);json(201,{raceId:room.id,config:room.config});return;
   }
   if(parts[0]!=='v1'||parts[1]!=='races'||parts.length!==4||!/^[-\w]{1,80}$/.test(parts[2])){json(404,{error:'Unknown endpoint'});return;}
   const [, ,raceId,action]=parts,room=rooms.get(raceId);
   if(action==='result'||action==='start'||action==='players'){
    if(!equal(bearer,adminKey)){json(401,{error:'Admin authentication required'});return;}
    // CHARTVOLT PATCH: register late entrants into an open-roster lobby. Idempotent per player id.
    if(action==='players'&&req.method==='POST'&&room){const b=await body();if(!Array.isArray(b.players)||b.players.length<1||b.players.length>16)throw Error('players must be a non-empty array');const now=Date.now();for(const p of b.players)room.addPlayer(p,now);json(200,{raceId:room.id,registered:[...room.players.keys()],scheduledStartAt:room.scheduledStartAt,status:room.status});return;}
    if(action==='result'&&req.method==='GET'){if(room?.isClosed())await archive(room);try{json(200,JSON.parse(await readFile(resolve(dataDir,raceId+'.json'),'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;json(room?202:404,{raceId,status:room?.status||'unavailable',final:false});}return;}
    if(action==='start'&&req.method==='POST'&&room){room.start(Date.now());json(200,{startAt:room.startAt});return;}
    json(404,{error:'Race not found'});return;
   }
   let claims;try{claims=verifyTicket(bearer,secret);}catch{json(401,{error:'Invalid or expired race ticket'});return;}
   if(claims.raceId!==raceId||!room||!room.players.has(claims.playerId)){json(403,{error:'Race membership required'});return;}
   const id=claims.playerId,p=room.player(id),now=Date.now();
   if(action==='join'&&req.method==='POST'){json(200,room.snapshot(id,now));return;}
   if(action==='events'&&req.method==='GET'){
    if(!room.mayEnter(p)){json(409,{error:'Race entry has closed'});return;}
    // Reason: `no-transform` stops every gzip layer on the path (Next.js's rewrite proxy compresses all responses, Cloudflare too) from holding snapshots back until a chunk fills.
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
    const old=p.connection;p.connection={res,exp:claims.exp};if(old)old.res.end();room.join(id,now);
    res.write('data: '+JSON.stringify(room.snapshot(id,now))+'\n\n');
    res.on('close',()=>{if(p.connection?.res===res){p.connection=null;room.disconnect(id,Date.now());}});return;
   }
   if(req.method==='POST'&&action==='input'){if(!p.connected||p.dnf||p.finishTimeMs!=null||room.isClosed()){await body();json(200,{accepted:false,ack:p.lastSeq,reason:'inactive'});return;}const ok=room.input(id,await body(),now);json(ok?200:409,{accepted:ok,ack:p.lastSeq,ackStep:p.ackStep,inputStep:p.queuedStep,serverTime:now});return;}
   if(req.method==='POST'&&action==='ship'){const b=await body();room.select(id,b.shipId);json(200,{shipId:p.sim.shipId});return;}
   if(req.method==='POST'&&action==='ready'){const b=await body();if(typeof b.ready!=='boolean')throw Error('ready must be boolean');room.ready(id,b.ready,now);json(200,{ready:p.ready,status:room.status,startAt:room.startAt});return;}
   if(req.method==='POST'&&action==='leave'){p.dnf=p.active&&room.status!=='lobby';p.connection?.res.end();room.disconnect(id,now);json(200,{left:true});return;}
   json(404,{error:'Unknown endpoint'});
  }catch(e){if(!res.headersSent)json(400,{error:e.message});else res.end();}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;
 let broadcastAt=0;
 const timer=setInterval(()=>{const now=Date.now();for(const [id,room]of rooms){room.advance(now);if(room.isClosed())void archive(room);if(now-broadcastAt>=100)for(const p of room.players.values())if(p.connection){const {res,exp}=p.connection;if(exp*1000<=now||res.writableLength>256*1024){res.end();continue;}res.write('data: '+JSON.stringify(room.snapshot(p.id,now))+'\n\n');}if((room.status==='lobby'&&now>room.lobbyExpiresAt())||(room.isClosed()&&saved.has(id)&&now-room.finishedAt>600000)){for(const p of room.players.values())p.connection?.res.end();rooms.delete(id);}}if(now-broadcastAt>=100)broadcastAt=now;},1000/60);
 return{server,rooms,close:async()=>{clearInterval(timer);for(const room of rooms.values())for(const p of room.players.values())p.connection?.res.end();await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const app=await createRaceServer();const {port,host}=raceEnvironment(process.env,root);app.server.listen(port,host,()=>console.log(`Volt Velocity authoritative race service listening on ${host}:${port}`));for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await app.close();process.exit(0)});}
