import afterburnFallback from '../assets/audio/afterburn.mp3';
import canopyFallback from '../assets/audio/canopy.mp3';
import ignitionFallback from '../assets/audio/ignition.mp3';
import horizonFallback from '../assets/audio/horizon.mp3';
import manifest from '../assets/audio/manifest.json';
import {SoundRack,SFX_NAMES} from './sound-rack.js';
/* CHARTVOLT PATCH (28 Sep 2026): MP3 only - the OGG copies doubled the bundle's music for no audible gain. */const fallbacks=[afterburnFallback,canopyFallback,ignitionFallback,horizonFallback],sources=fallbacks;
export const SOUNDTRACK=manifest.tracks.map((t,i)=>({...t,url:sources[i],fallback:fallbacks[i]}));
const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export class RaceAudio {
  constructor(){this.musicVolume=.75;this.sfxVolume=.9;this.muted=false;this.musicMuted=false;this.sfxMuted=false;this.tick=0;this.playing=false;this.cache=new Map();this.musicVoices=new Set();this.selection='auto';this.trackId='orbital';this.seed=0;this.request=0;this.effects={};this.status='locked';this.last={};}
  async unlock(){
    if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C){this.status='unavailable';return;}
      this.ctx=new C({latencyHint:'interactive'});const c=this.ctx;
      this.music=c.createGain();this.fx=c.createGain();this.duck=c.createGain();this.master=c.createGain();
      const compressor=c.createDynamicsCompressor();compressor.threshold.value=-9;compressor.knee.value=8;compressor.ratio.value=5;compressor.attack.value=.003;compressor.release.value=.18;
      const limiter=c.createWaveShaper(),curve=new Float32Array(4097);for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=.95*Math.tanh(x/.95);}limiter.curve=curve;limiter.oversample='2x';
      this.music.connect(this.duck);this.duck.connect(compressor);this.fx.connect(compressor);compressor.connect(limiter);limiter.connect(this.master);this.master.connect(c.destination);
      this.rack=new SoundRack(c,this.fx);this.applyLevels();this.status='loading';
    }
    // Resume inside the user's gesture before decoding. A source loops on the
    // audio thread, independent of render frames or JavaScript timers.
    await this.ctx.resume();if(!this.prepared)this.prepare().catch(e=>{this.status='music unavailable';console.warn('Soundtrack could not be decoded',e);});
  }
  selected(){if(this.selection!=='auto')return SOUNDTRACK.find(t=>t.id===this.selection)||SOUNDTRACK[0];const id=this.trackId;return SOUNDTRACK[/volcano|reactor|foundry|solar/.test(id)?2:/jungle|coast/.test(id)?1:/orbital|asteroid|eclipse|frozen|alpine/.test(id)?3:0];}
  begin(trackId,seed=0){this.stopMusic();this.trackId=trackId;this.seed=seed;this.last={};this.finishPlayed=false;this.playing=false;this.rack?.silence();this.tick=0;this.prepare().catch(()=>{});}
  async decode(track){
    if(this.cache.has(track.id))return this.cache.get(track.id);
    const promise=(async()=>{for(const url of [track.url,track.fallback]){try{const response=await fetch(url);if(!response.ok)throw Error('Audio data unavailable');const decoded=await this.ctx.decodeAudioData(await response.arrayBuffer());if(decoded.duration<track.duration-.05)throw Error('Incomplete soundtrack');return decoded;}catch(e){if(url===track.fallback)throw e;}}})();
    this.cache.set(track.id,promise);try{const buffer=await promise;while(this.cache.size>2){const old=[...this.cache.keys()].find(k=>k!==track.id&&k!==this.current?.track.id);if(!old)break;this.cache.delete(old);}return buffer;}catch(e){this.cache.delete(track.id);throw e;}
  }
  async prepare(){if(!this.ctx||this.ctx.state==='closed')return;const track=this.selected(),request=++this.request;this.status='loading';const buffer=await this.decode(track);if(request!==this.request)return;this.prepared={track,buffer};this.status='ready';if(this.playing)this.playMusic();}
  playMusic(){if(!this.prepared||!this.ctx||!this.playing)return;const {track,buffer}=this.prepared;if(this.current?.track.id===track.id)return;
    const c=this.ctx,t=c.currentTime,source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=Math.min(buffer.duration,track.duration);source.connect(gain);gain.connect(this.music);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(1,t+1.1);source.start(t);this.musicVoices.add(source);const previous=this.current;
    if(previous){previous.gain.gain.cancelScheduledValues(t);previous.gain.gain.setTargetAtTime(0,t,.22);previous.source.stop(t+1.2);}
    source.onended=()=>{source.disconnect();gain.disconnect();this.musicVoices.delete(source);};this.current={track,source,gain,started:t};this.status='playing';
  }
  stopMusic(){this.request++;for(const source of this.musicVoices){try{source.stop();}catch{}}this.musicVoices.clear();this.current=null;this.prepared=null;this.status=this.ctx?'ready':'locked';}
  setTrack(id){this.selection=SOUNDTRACK.some(t=>t.id===id)?id:'auto';this.prepare().catch(()=>{});}
  update(s){
    this.playing=s.state==='racing'||s.state==='countdown';if(!this.ctx||this.ctx.state!=='running')return;
    if(this.playing)this.playMusic();const t=this.ctx.currentTime;
    if(this.current)this.tick=Math.floor((t-this.current.started)*this.current.track.bpm/60*4);
    const racing=s.state==='racing'&&!(s.respawnRemaining>0);this.rack.drive(racing?s:null,this.trackId);
    if(s.state==='countdown'){const count=Math.ceil(s.countdown);if(count!==this.last.countdown)this.effect('countdown');this.last.countdown=count;}
    if(racing&&this.last.state==='countdown')this.effect('start');
    if(racing&&s.boosting&&!this.last.boosting)this.effect('boost');
    if(racing&&s.braking&&!this.last.braking&&s.speed>15)this.effect('brake');
    if(racing&&s.hull<=.25&&(t-(this.last.warningAt||-10)>2.4)){this.effect('low-health');this.last.warningAt=t;}
    this.last.state=s.state;this.last.boosting=s.boosting;this.last.braking=s.braking;
  }
  effect(type,detail={}){if(!this.rack||this.ctx.state!=='running')return;const name=this.rack.effect(type,detail);if(name){this.effects[name]=(this.effects[name]||0)+1;if(['ship-destroyed','destroyed'].includes(type)){const t=this.ctx.currentTime;this.duck.gain.cancelScheduledValues(t);this.duck.gain.setValueAtTime(.4,t);this.duck.gain.linearRampToValueAtTime(1,t+1.6);}}}
  combat(e,self,distance=0){const local=e.source===self||e.target===self,range=Math.abs(distance);if(!local&&range>180)return;this.effect(e.type,{...e,volume:local?1:.55*(1-range/180),pan:Math.max(-.7,Math.min(.7,(e.lane||0)/18))});}
  finish(){if(this.finishPlayed)return;this.finishPlayed=true;this.playing=false;this.rack?.silence();if(!this.ctx)return;const c=this.ctx,t=c.currentTime;this.effect('finish');if(this.current){const voice=this.current;voice.gain.gain.cancelScheduledValues(t);voice.gain.gain.setTargetAtTime(0,t,.12);voice.source.stop(t+.6);this.current=null;}const request=++this.request;clearTimeout(this.finishTimer);this.finishTimer=setTimeout(()=>{if(request===this.request&&!this.playing)this.pause();},2200);}
  pause(){if(this.ctx?.state==='running')this.ctx.suspend();}
  applyLevels(){if(!this.ctx)return;const t=this.ctx.currentTime;this.music.gain.setTargetAtTime(this.musicMuted?0:this.musicVolume,t,.025);this.fx.gain.setTargetAtTime(this.sfxMuted?0:this.sfxVolume,t,.025);this.master.gain.setTargetAtTime(this.muted?0:.94,t,.025);}
  levels(music,sfx){this.musicVolume=clamp(music);this.sfxVolume=clamp(sfx);this.applyLevels();}
  muteBus(bus,value){if(bus==='music')this.musicMuted=Boolean(value);if(bus==='sfx')this.sfxMuted=Boolean(value);this.applyLevels();}
  mute(){this.muted=!this.muted;this.applyLevels();return this.muted;}
  state(){return {state:this.ctx?.state||'locked',musicStep:this.tick,muted:this.muted,musicMuted:this.musicMuted,sfxMuted:this.sfxMuted,musicVolume:this.musicVolume,sfxVolume:this.sfxVolume,track:this.current?.track.title||this.selected().title,trackId:this.current?.track.id||this.selected().id,status:this.status,loop:this.current?.source.loop||false,loopDuration:this.current?.source.loopEnd||0,musicTime:this.current?(this.ctx.currentTime-this.current.started)%this.current.source.loopEnd:0,musicSources:this.musicVoices.size,voices:this.rack?.voices.size||0,effects:{...this.effects},availableEffects:SFX_NAMES.length};}
  dispose(){clearTimeout(this.finishTimer);this.stopMusic();this.rack?.dispose();this.ctx?.close();}
}
