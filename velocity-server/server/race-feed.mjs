import {stepSlipstream} from './power-effects.mjs';
import {centimetres} from './wire-precision.mjs';
const roundEvent=e=>({...e,distance:centimetres(e.distance),lane:centimetres(e.lane)});
/**
 * CHARTVOLT PATCH (13 Oct 2026, owner, after the legal opinion): replaces the vendor's PlayerCombat.
 *
 * A paid Volt Velocity race is SKILL-ONLY. Nothing one pilot does may lower another pilot's hull,
 * speed, energy or position, so this module owns no weapons at all:
 *  - no blaster, no player-locked missile, no mines, EMP, shockwave, slick or cloak;
 *  - every pickup is per pilot (each simulation collects its own capsules - `competitiveCombat`
 *    is false), and missiles and seekers lock onto TOWERS inside the pilot's own simulation;
 *  - ships never touch at all (owner, 14 Oct 2026: "remove the collision between the ships"): two hulls
 *    sharing the road pass through each other, so no pilot's line can be pushed, slowed or blocked by another's.
 *
 * What it keeps is the broadcast: the event feed the client draws, and slipstream.
 * Slipstream rewards the follower without touching the leader, so it stays.
 */
export class RaceFeed {
 constructor(room){this.room=room;this.events=[];this.nextId=1;}
 delta(a,b){const l=this.room.track.length;return ((b-a+l*1.5)%l+l)%l-l*.5;}
 racers(){return [...this.room.players.values()].filter(p=>p.active&&!p.dnf&&p.finishTimeMs==null&&p.sim.state==='racing'&&p.sim.respawnRemaining<=0);}
 event(type,p,other=null,kind=null){const e={id:this.nextId++,tick:this.room.tick,type,source:p?.id||null,target:other?.id||null,distance:(other||p)?.sim.distance||0,lane:(other||p)?.sim.lateral||0,kind};this.events.push(e);if(this.events.length>96)this.events.shift();return e;}
 step(dt){
  for(const p of this.room.players.values())for(const e of p.sim.events){
   // Reason: with no weapons, a destroyed ship is always the course's doing (tower fire, wall, lava) - there is no killer to credit.
   if(e.type==='ship-destroyed')this.event('destroyed',null,p,'impact');
   else if(['respawn','checkpoint','lap','skill','incoming','impact','blocked','pad','evade','intercept','destroy','no-target','gate-missed','pickup','use'].includes(e.type)){const event=this.event(e.type,p,null,e.kind||e.source);if(e.type==='skill'){event.label=e.label;event.points=e.points;event.chain=e.chain;}if(e.key){const h=p.sim.content.hazards[Number(e.key.split(':')[1])];event.distance=(p.sim.lap-1)*p.sim.length+h.distance;event.lane=h.lane;event.height=h.height;}}
  }
  stepSlipstream(this,this.racers());
 }
 /** The `combat` key is kept for client compatibility; everything that described a rival's weapon is now always empty. */
 /**
  * CHARTVOLT PATCH (14 Oct 2026, owner: smoother on a weak connection): `after` is the last event id this
  * connection was already sent. An event used to ride in every snapshot for its whole three-second window -
  * thirty copies of each, about 40% of every message. The stream is TCP and the client skips ids it has
  * already drawn (`e.id<=lastCombatEvent`), so each event now travels once; a new connection starts at 0
  * and still receives the full window.
  */
 snapshot(after=0){return{lockTarget:null,bolts:[],missiles:[],mines:[],slicks:[],unavailablePickups:[],events:this.events.filter(e=>this.room.tick-e.tick<180&&e.id>after).map(roundEvent),stats:{},incoming:false,combatVersion:2,skillOnly:true};}
}
