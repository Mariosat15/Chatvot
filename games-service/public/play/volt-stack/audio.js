/* Volt Stack Audio 1.1 — original synthesis, local music assets, no external service. */
(() => {
  'use strict';
  const TRACKS=[{name:'Neon Drive',url:'assets/audio/01_neon_drive.flac',bpm:128},{name:'Voltage Rush',url:'assets/audio/02_voltage_rush.flac',bpm:144}];
  const EFFECTS=['move','rotate','wallKick','hold','lock','hardDrop','single','double','triple','tetris','tspinMini','tspin','b2b','combo','perfect','levelUp','achievement','countdown','go','warning','danger','dangerCritical','pause','resume','personalBest','gameover'];
  // Reason: stock defaults (.65 / .8 into a soft compressor) read as almost muted in the
  // arena iframe. OUTPUT multipliers sit after the 0–1 sliders so settings stay familiar while
  // playback is clearly louder (owner, 27 Sep 2026).
  const MUSIC_OUTPUT=2.4,EFFECTS_OUTPUT=2.5;
  let context,master,compressor,enabled=true,musicVolume=1,effectsVolume=1,track=0,gameState='ready',duckUntil=0,lastMove=-Infinity,disposed=false;
  let musicBus,source=null,offset=0,startedAt=0,musicError=null;
  const buffers=new Map(),loads=new Map();
  const activeMusic=()=>enabled&&!disposed&&!document.hidden&&musicVolume>0&&['playing','clearing','collapsing'].includes(gameState);
  function position(){const duration=buffers.get(track)?.duration||1;return source?(offset+context.currentTime-startedAt)%duration:offset;}
  function stopMusic(){
    if(!source)return;
    offset=position();const old=source;source=null;
    // A tiny gain ramp avoids a click without losing the resume position.
    old.envelope.gain.cancelScheduledValues(context.currentTime);
    old.envelope.gain.setTargetAtTime(0,context.currentTime,.003);
    old.stop(context.currentTime+.02);
  }
  async function loadTrack(index){
    if(buffers.has(index))return buffers.get(index);
    if(!loads.has(index))loads.set(index,(async()=>{
      const response=await fetch(TRACKS[index].url);
      if(!response.ok)throw Error('Soundtrack unavailable');
      const buffer=await context.decodeAudioData(await response.arrayBuffer());
      buffers.set(index,buffer);return buffer;
    })());
    return loads.get(index);
  }
  function prepareTrack(){
    if(!context||buffers.has(track)||loads.has(track))return;
    const selected=track;
    loadTrack(selected).then(()=>{if(selected===track&&!disposed){musicError=null;update();}})
      .catch(()=>{if(selected===track)musicError='Music could not load. Select the track again to retry.';});
  }
  function startMusic(){
    if(source||!context||context.state!=='running'||!activeMusic())return;
    const buffer=buffers.get(track);
    if(!buffer){
      prepareTrack();
      return;
    }
    source=context.createBufferSource();source.buffer=buffer;
    source.loop=true;source.loopStart=0;source.loopEnd=buffer.duration;
    const envelope=context.createGain();source.envelope=envelope;
    envelope.gain.setValueAtTime(0,context.currentTime);envelope.gain.setTargetAtTime(1,context.currentTime,.006);
    source.connect(envelope);envelope.connect(musicBus);
    const node=source;node.onended=()=>{node.disconnect();envelope.disconnect();};
    offset%=buffer.duration;startedAt=context.currentTime;source.start(startedAt,offset);
  }
  const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
  function graph(c){const bus=c.createGain(),comp=c.createDynamicsCompressor();comp.threshold.value=-18;comp.knee.value=18;comp.ratio.value=3.5;comp.attack.value=.003;comp.release.value=.2;bus.connect(comp);comp.connect(c.destination);return {bus,comp};}
  function unlock(){
    if(disposed)return;
    if(!context){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;context=new AC();const x=graph(context);master=x.bus;compressor=x.comp;master.gain.value=enabled?effectsVolume*EFFECTS_OUTPUT:0;musicBus=context.createGain();musicBus.gain.value=0;musicBus.connect(context.destination);}
    prepareTrack();
    if(context.state==='suspended')context.resume().then(()=>update()).catch(()=>{});
  }
  function synth(c,bus,name,value=0){
    const start=c.currentTime+.006;
    function note(f,d=.1,amp=.15,type='sine',offset=0,to=null){
      const t=start+offset,o=c.createOscillator(),env=c.createGain(),filter=c.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+d);filter.type='lowpass';filter.frequency.value=type==='sawtooth'?2400:7000;
      // ~1.7× louder synth voices — paired with EFFECTS_OUTPUT on the master bus.
      amp=Math.min(.95,amp*1.7);
      env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(amp,t+.004);env.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(filter);filter.connect(env);env.connect(bus);o.start(t);o.stop(t+d+.015);o.onended=()=>{o.disconnect();filter.disconnect();env.disconnect()};
    }
    function hiss(d=.1,amp=.1,offset=0,cutoff=2200){
      const t=start+offset,len=Math.ceil(c.sampleRate*d),buffer=c.createBuffer(1,len,c.sampleRate),data=buffer.getChannelData(0);let seed=837;
      for(let i=0;i<len;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/2147483648-1);}
      amp=Math.min(.85,amp*1.7);
      const source=c.createBufferSource(),filter=c.createBiquadFilter(),env=c.createGain();source.buffer=buffer;filter.type='highpass';filter.frequency.value=cutoff;env.gain.setValueAtTime(amp,t);env.gain.exponentialRampToValueAtTime(.0001,t+d);source.connect(filter);filter.connect(env);env.connect(bus);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();env.disconnect()};
    }
    function fanfare(notes,step=.055,amp=.13){notes.forEach((f,i)=>{note(f,.22,amp,'triangle',i*step);note(f,.32,amp*.17,'sine',i*step+.14)});}
    switch(name){
      case'move':note(230,.034,.065,'triangle',0,170);break;
      case'rotate':note(490,.075,.10,'sine',0,740);note(980,.045,.025,'triangle',.018);break;
      case'wallKick':note(330,.065,.1,'triangle',0,660);note(990,.085,.06,'sine',.035);break;
      case'hold':note(660,.10,.10,'triangle',0,330);note(880,.15,.09,'sine',.065);break;
      case'lock':note(160,.065,.14,'sine',0,70);hiss(.025,.026,0,3000);break;
      case'hardDrop':note(180,.18,.38,'sine',0,42);note(90,.13,.08,'triangle',.015,38);hiss(.11,.10,0,900);break;
      case'single':fanfare([523,784],.06,.12);break;
      case'double':fanfare([523,659,1047],.052,.12);hiss(.08,.04,.025);break;
      case'triple':fanfare([523,659,784,1047],.047,.13);note(110,.18,.18,'sine',0,55);hiss(.11,.06);break;
      case'tetris':fanfare([523,659,784,1047,1319],.052,.16);note(160,.23,.27,'sine',0,45);hiss(.19,.10,0,1400);break;
      case'tspinMini':fanfare([494,740,988],.045,.11);break;
      case'tspin':note(260,.13,.13,'sawtooth',0,1040);fanfare([659,988,1319],.075,.14);break;
      case'b2b':fanfare([1047,1568],.07,.09);break;
      case'combo':{const f=523*Math.pow(2,Math.min(8,value)/12);fanfare([f,f*1.25,f*1.5],.04,.09);break;}
      case'perfect':fanfare([523,659,784,1047,1319,1568],.09,.15);[523,659,784].forEach(f=>note(f,.65,.08,'sine',.58));hiss(.35,.07,.08,3000);break;
      case'levelUp':fanfare([392,523,659,784,1047],.085,.13);note(98,.32,.15,'sine',0,196);break;
      case'achievement':fanfare([784,988,1175,1568],.08,.10);break;
      case'countdown':note(660,.11,.12,'sine');note(1320,.07,.025,'sine');break;
      case'go':fanfare([523,784,1047],.06,.15);note(100,.15,.18,'sine',0,50);break;
      case'warning':note(880,.12,.11,'sine');note(660,.13,.10,'sine',.19);break;
      case'danger':note(196,.14,.10,'triangle',0,165);break;
      case'dangerCritical':note(220,.18,.14,'triangle',0,110);note(330,.14,.07,'sine',.22,165);break;
      case'pause':note(523,.13,.08,'sine',0,262);break;
      case'resume':note(262,.12,.08,'sine',0,523);break;
      case'personalBest':fanfare([523,659,784,1047,1319,1568,2093],.085,.14);[523,659,784].forEach(f=>note(f,.65,.07,'sine',.6));break;
      case'gameover':fanfare([440,392,330,220],.16,.12);note(110,.65,.16,'sine',.35,55);break;
    }
  }
  function play(name,value=0){
    if(!enabled||disposed)return;unlock();if(!context)return;
    if(name==='move'){if(context.currentTime-lastMove<.042)return;lastMove=context.currentTime;}
    if(['tetris','perfect','levelUp','personalBest','gameover'].includes(name))duckUntil=performance.now()+750;
    synth(context,master,name,value);
  }
  function update({state}={}){
    gameState=state||gameState;
    if(!context)return;
    const active=activeMusic();
    const desired=active?musicVolume*MUSIC_OUTPUT*(performance.now()<duckUntil?.65:1):0;
    musicBus.gain.setTargetAtTime(desired,context.currentTime,.025);
    if(active)startMusic();else stopMusic();
  }
  function setEnabled(v){enabled=Boolean(v);if(context)master.gain.setTargetAtTime(enabled?effectsVolume*EFFECTS_OUTPUT:0,context.currentTime,.012);if(enabled)unlock();update();}
  function setMusicVolume(v){musicVolume=clamp(v);update();return musicVolume;}
  function setEffectsVolume(v){effectsVolume=clamp(v);if(context)master.gain.setTargetAtTime(enabled?effectsVolume*EFFECTS_OUTPUT:0,context.currentTime,.015);return effectsVolume;}
  function setTrack(v){const index=Math.max(0,Math.min(TRACKS.length-1,Math.trunc(Number(v)||0)));if(index===track&&!musicError)return;stopMusic();if(musicError)loads.delete(index);musicError=null;track=index;offset=0;prepareTrack();update();}
  function reset(){stopMusic();offset=0;gameState='ready';update();}
  function dispose(){stopMusic();disposed=true;buffers.clear();context?.close().catch(()=>{});}
  document.addEventListener('visibilitychange',()=>update());
  window.addEventListener('pagehide',()=>{stopMusic();if(context?.state==='running')context.suspend().catch(()=>{});});
  window.VoltAudio={unlock,play,update,setEnabled,setMusicVolume,setEffectsVolume,setTrack,reset,dispose,tracks:TRACKS,effects:EFFECTS,
    getStatus:()=>({enabled,musicVolume,effectsVolume,track,playing:Boolean(source),musicTime:position(),loopDuration:buffers.get(track)?.duration||0,looping:Boolean(source?.loop),loaded:buffers.has(track),contextState:context?.state||'uninitialized',musicError,masterGain:master?.gain.value||0}),
    async renderEffect(name,value=0){if(!EFFECTS.includes(name))throw new Error('Unknown effect');const c=new OfflineAudioContext(2,Math.ceil(1.7*44100),44100),x=graph(c);x.bus.gain.value=.8;synth(c,x.bus,name,value);return c.startRendering();}
  };
})();
