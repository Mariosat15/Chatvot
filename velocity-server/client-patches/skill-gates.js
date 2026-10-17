// CHARTVOLT PATCH (28 Sep 2026, owner: "change graphics, make them like gates
// and more neon colors, different ones"). Replaces the vendor's thin cyan arch.
//
// Reason: the vendor drew a 9 m arch but scored only the middle 6.4 m, so the
// drawing lied about where a gate counts. Every dimension here comes from
// GATE_HALF_WIDTH, the same constant simulation.js scores against, so the
// pylons ARE the edges of the scoring zone.
//
// Cost: two shared geometries and three unlit materials per gate (8 gates),
// no lights and no textures, so it is cheaper than the torus it replaces.
import * as T from 'three';
import {GATE_HALF_WIDTH} from './simulation.js';

const PALETTE=[0x19f0ff,0xff2bd6,0x39ff7a,0xffb21e,0x9b5cff,0xff4d4d];
const MISS_COLOR=0xff2a2a;
const HEIGHT=5.2,POST=.34,BAR=.3;
// Seconds a gate stays on screen after it is resolved, so the player sees what happened.
const HIT_FADE=.7,MISS_FADE=.9;

let shared=null;
function geometries(){
  if(shared)return shared;
  shared={
    post:new T.BoxGeometry(POST,HEIGHT,POST),
    bar:new T.BoxGeometry(GATE_HALF_WIDTH*2+POST,BAR,BAR),
    curtain:new T.PlaneGeometry(GATE_HALF_WIDTH*2,HEIGHT-BAR),
    pad:new T.PlaneGeometry(1.4,1.4),
  };
  return shared;
}
// toneMapped:false keeps the scaled colour above the bloom threshold (1.35), which is what makes it read as neon.
const glow=(hex,boost)=>new T.MeshBasicMaterial({color:new T.Color(hex).multiplyScalar(boost),toneMapped:false});

export function buildSkillGates(view){
  view.skillGates=[];const geo=geometries();
  (view.content.gates||[]).forEach((gate,i)=>{
    const hex=PALETTE[i%PALETTE.length],f=view.track.frame(gate.distance),g=new T.Group();
    const frame=glow(hex,2.4),pad=glow(hex,1.8);
    const curtain=new T.MeshBasicMaterial({color:new T.Color(hex),transparent:true,opacity:.14,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
    for(const x of [-GATE_HALF_WIDTH,GATE_HALF_WIDTH]){
      const post=new T.Mesh(geo.post,frame);post.position.set(x,HEIGHT/2,0);g.add(post);
      const base=new T.Mesh(geo.pad,pad);base.rotation.x=-Math.PI/2;base.position.set(x,.04,0);g.add(base);
    }
    const bar=new T.Mesh(geo.bar,frame);bar.position.y=HEIGHT;g.add(bar);
    const field=new T.Mesh(geo.curtain,curtain);field.position.y=(HEIGHT-BAR)/2;g.add(field);
    g.position.copy(f.p).addScaledVector(f.right,gate.lane);
    g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(f.right,f.up,f.forward.clone().negate()));
    g.userData={frame,pad,curtain,hex,field,state:'open',since:0,key:''};
    view.scene.add(g);view.skillGates.push(g);
  });
}

// Reason: the vendor hid a gate the instant it was resolved, so a hit and a miss
// looked identical (the gate just vanished). A hit now flares and expands; a miss
// turns red and sinks. Both fade out, then hide.
export function updateSkillGates(view,s,t){
  view.skillGates.forEach((g,i)=>{
    const d=g.userData,key=`${s.lap}:${i}`;
    const state=s.gatesHit.has(key)?'hit':s.gatesMissed.has(key)?'missed':'open';
    // A new lap reopens every gate; restore its colour and size.
    if(d.key!==key||state==='open'&&d.state!=='open'){d.key=key;d.state='open';resetGate(g);}
    if(state!==d.state){d.state=state;d.since=t;if(state==='missed'){d.frame.color.setHex(MISS_COLOR).multiplyScalar(2);d.pad.color.setHex(MISS_COLOR);d.curtain.color.setHex(MISS_COLOR);}}
    if(state==='open'){g.visible=true;const pulse=.5+.5*Math.sin(t*3+i);d.curtain.opacity=.1+pulse*.1;d.field.scale.set(1,1,1);return;}
    const age=t-d.since,span=state==='hit'?HIT_FADE:MISS_FADE,k=Math.min(1,age/span);
    if(k>=1){g.visible=false;return;}
    g.visible=true;
    if(state==='hit'){d.curtain.opacity=.55*(1-k);const grow=1+k*.35;g.scale.set(grow,grow,1);}
    else{d.curtain.opacity=.3*(1-k);g.scale.set(1,1-k*.6,1);}
  });
}

function resetGate(g){
  const d=g.userData;g.scale.set(1,1,1);g.visible=true;
  d.frame.color.setHex(d.hex).multiplyScalar(2.4);d.pad.color.setHex(d.hex).multiplyScalar(1.8);d.curtain.color.setHex(d.hex);
}
