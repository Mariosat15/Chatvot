import {PROTOCOL_VERSION,EMPTY_INPUT} from './multiplayer-state.js';
import {encodeFrame,quantizeInput,MAX_FRAMES_PER_MESSAGE} from './input-frames.js';
// CHARTVOLT PATCH: at most this many input requests may be on the wire at once. The vendor
// allowed one, so a single slow round trip froze every later control on the way to the server.
const MAX_IN_FLIGHT=4;
// CHARTVOLT PATCH: frames kept for replay (~4 s). Older unconfirmed frames mean the link is
// broken, and replaying further back would only paint a guess.
const MAX_HISTORY=240;
export class MultiplayerClient {
 constructor({url,ticket,raceId,onSnapshot,onStatus}){
  const u=new URL(url);if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error('Race service requires HTTPS (HTTP allowed only on localhost)');
  if(!/^[-\w]{1,80}$/.test(raceId)||typeof ticket!=='string')throw Error('Invalid connection parameters');
  this.base=u.href.replace(/\/$/,'')+'/v1/races/'+raceId;this.ticket=ticket;this.onSnapshot=onSnapshot;this.onStatus=onStatus;this.seq=0;this.latest=EMPTY_INPUT;this.pendingFire=false;this.closed=false;this.controller=new AbortController();this.connected=false;this.inFlight=false;this.lastSnapshot=0;
  // CHARTVOLT PATCH: step-numbered frames. `framed` is set only when the server reports step
  // acknowledgements, so this client still drives an unpatched server the vendor way.
  this.framed=false;this.frames=[];this.nextStep=0;this.ackStep=-1;this.inputStep=-1;this.sending=0;this.rtt=150;
 }
 async request(action,data){const res=await fetch(this.base+'/'+action,{method:'POST',headers:{Authorization:'Bearer '+this.ticket,'Content-Type':'application/json'},body:JSON.stringify(data||{}),signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(action==='join'?30000:10000)])});const value=await res.json();if(!res.ok)throw Error(value.error||'Race request rejected');return value;}
 async connect(){const initial=await this.request('join');if(initial.protocol!==PROTOCOL_VERSION)throw Error('Incompatible race protocol');this.playerId=initial.playerId;this.seq=initial.ack+1;this.config=initial.config;this.framed=Number.isSafeInteger(initial.inputStep)&&Number.isSafeInteger(initial.ackStep);if(this.framed){this.inputStep=initial.inputStep;this.ackStep=initial.ackStep;this.nextStep=initial.inputStep+1;}this.timer=setInterval(()=>this.send(),50);void this.stream();return initial;}
 async stream(){let attempt=0;while(!this.closed){try{
   this.onStatus(attempt?'reconnecting':'connecting');this.streamController=new AbortController();this.lastSnapshot=performance.now();const res=await fetch(this.base+'/events',{headers:{Authorization:'Bearer '+this.ticket},signal:AbortSignal.any([this.controller.signal,this.streamController.signal])});if(!res.ok){const e=Error('Race connection rejected ('+res.status+')');e.terminal=[401,403,404,409].includes(res.status);throw e;}
   const reader=res.body.getReader(),decoder=new TextDecoder();let pending='';this.connected=true;attempt=0;this.onStatus('connected');
   while(!this.closed){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});if(pending.length>2e6)throw Error('Invalid race stream');let end;while((end=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,end);pending=pending.slice(end+2);if(!block.startsWith('data: '))continue;const s=JSON.parse(block.slice(6));if(s.protocol!==PROTOCOL_VERSION||s.playerId!==this.playerId)throw Error('Invalid race snapshot');this.lastSnapshot=performance.now();this.onStatus('connected');this.racing=s.status==='racing'&&s.self.state==='racing';this.seq=Math.max(this.seq,s.ack+1);this.acknowledge(s);this.onSnapshot(s);}}
  }catch(e){if(this.closed)break;if(e.terminal){this.onStatus('rejected');this.close();return;}}
  if(this.closed)break;this.connected=false;this.latest=EMPTY_INPUT;this.pendingFire=false;this.onStatus('reconnecting');await new Promise(r=>setTimeout(r,Math.min(3000,500*++attempt)));
 }}
 input(value){this.latest=value;this.pendingFire ||= value.fire;}
 /**
  * CHARTVOLT PATCH. Number the controls for one predicted physics step and keep them for replay.
  * Returns the quantised frame the caller MUST predict with (so it matches the server bit for bit),
  * or null against an unpatched server.
  */
 record(value){if(!this.framed)return null;const frame=quantizeInput(this.nextStep++,value);this.frames.push(frame);if(this.frames.length>MAX_HISTORY)this.frames.shift();return frame;}
 /** CHARTVOLT PATCH. Frames the given snapshot has not applied yet, oldest first. */
 pendingFrames(ackStep){return this.frames.filter(f=>f.step>ackStep);}
 /** CHARTVOLT PATCH. How far to draw other ships ahead of their last reported position, in seconds. */
 leadSeconds(){return Math.min(.35,Math.max(0,(performance.now()-this.lastSnapshot)/1000+this.rtt/2000));}
 // Reason: only a SNAPSHOT may retire history. An input response reports a newer ack than the
 // snapshot the game is about to reconcile against, and retiring on it loses frames to replay.
 acknowledge(s){if(!this.framed)return;if(Number.isSafeInteger(s.inputStep)&&s.inputStep>this.inputStep)this.inputStep=s.inputStep;if(Number.isSafeInteger(s.ackStep)&&s.ackStep>this.ackStep){this.ackStep=s.ackStep;const i=this.frames.findIndex(f=>f.step>this.ackStep);this.frames=i<0?[]:this.frames.slice(i);}}
 async send(){if(this.connected&&performance.now()-this.lastSnapshot>3000)this.streamController?.abort();if(this.closed||!this.connected||!this.racing)return;if(this.framed)return this.sendFrames();if(this.inFlight)return;this.inFlight=true;const command={...this.latest,fire:this.latest.fire||this.pendingFire};this.pendingFire=false;try{await this.request('input',{seq:this.seq++,input:command});}catch(e){if(!this.closed)this.onStatus('unstable');}finally{this.inFlight=false;}}
 /**
  * CHARTVOLT PATCH. Every frame the server has not yet queued goes in every message, so a lost or
  * overtaken request costs nothing: the next one carries the same steps and the server keeps only
  * steps it has not seen. A 409 is the server refusing an overtaken request, which is harmless.
  */
 async sendFrames(){if(this.sending>=MAX_IN_FLIGHT)return;const unsent=this.frames.filter(f=>f.step>this.inputStep).slice(-MAX_FRAMES_PER_MESSAGE);if(!unsent.length)return;this.sending++;const started=performance.now();
  try{const res=await fetch(this.base+'/input',{method:'POST',headers:{Authorization:'Bearer '+this.ticket,'Content-Type':'application/json'},body:JSON.stringify({seq:this.seq++,input:unsent.at(-1).input,frames:unsent.map(f=>encodeFrame(f.step,f.input))}),signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(5000)])});const value=await res.json().catch(()=>({}));
   if(res.ok){this.rtt=this.rtt*.8+(performance.now()-started)*.2;if(Number.isSafeInteger(value.inputStep)&&value.inputStep>this.inputStep)this.inputStep=value.inputStep;}else if(res.status!==409)throw Error(value.error||'Race input rejected');
  }catch(e){if(!this.closed)this.onStatus('unstable');}finally{this.sending--;}}
 select(shipId){return this.request('ship',{shipId});}ready(value=true){return this.request('ready',{ready:value});}
 async leave(){try{await this.request('leave');}finally{this.close();}}
 close(){this.closed=true;this.connected=false;clearInterval(this.timer);this.controller.abort();}
}
