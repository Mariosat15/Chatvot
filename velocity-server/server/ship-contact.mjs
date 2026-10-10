// CHARTVOLT PATCH (28 Sep 2026, owner: "when hit the planes move like when actually
// hit something; now it is like ghosts").
//
// Reason: the vendor resolved a contact by moving the ships apart sideways and
// nothing else. The simulation rebuilds lateral velocity from `heading` every
// tick (lateralVelocity = speed * sin(heading)), so steering pushed them straight
// back together and they slid along each other. A rear-end got no response at all.
// A bounce therefore has to change `heading`, exactly as the wall bounce in
// simulation.js already does; setting lateralVelocity alone is overwritten next tick.
//
// Server-only and authoritative. The client never simulates contacts; it adopts
// the corrected heading on reconcile and eases the difference, so every racer
// sees the same outcome. Two vendor rules survive unchanged:
//  - no contact awards forward progress (the rammed ship never gains speed), and
//  - the positional side push still keeps ships inside the walls.

import {DRIVE_LIMIT} from '../src/road-width.js';

export const CONTACT_LENGTH=5.5;
export const CONTACT_WIDTH=3.5;
const WALL=DRIVE_LIMIT-.1;  // vendor 13.2 against a 13.3 drive limit
const RESTITUTION=.45;      // share of the closing speed returned as bounce
const MIN_SEPARATION=8;     // m/s: even a gentle touch visibly pushes apart
const YAW_KICK=.45;         // rad/s of nose wobble at full force
const REAR_BOUNCE=.35;      // rammer ends this share of the closing speed slower than the car it hit
const MIN_STEERABLE=15;     // m/s: below this, heading cannot express a sideways shove

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// Changes the sideways velocity the next tick will compute, keeping speed.
function setLateralVelocity(s,v){
  if(s.speed<MIN_STEERABLE)return;
  s.heading=clamp(Math.asin(clamp(v/s.speed,-.9,.9)),-1.3,1.3);
  s.lateralVelocity=s.speed*Math.sin(s.heading);
}

function sideImpulse(x,y,sign,minSeparation){
  const mx=x.ship.armor,my=y.ship.armor,m=mx+my;
  const vx=x.speed*Math.sin(x.heading),vy=y.speed*Math.sin(y.heading);
  const rel=(vy-vx)*sign;                           // > 0 means already separating
  if(rel>=minSeparation)return 0;
  const target=rel<0?Math.max(-rel*RESTITUTION,minSeparation):minSeparation;
  const change=target-rel;
  setLateralVelocity(x,vx-sign*change*my/m);
  setLateralVelocity(y,vy+sign*change*mx/m);
  const k=Math.min(1,change/12);
  x.yawRate-=sign*YAW_KICK*k*my/m*2;
  y.yawRate+=sign*YAW_KICK*k*mx/m*2;
  const scrub=1-Math.min(.08,change*.004);
  x.speed*=scrub;y.speed*=scrub;
  return change;
}

/**
 * Resolves one overlapping pair. `dx` is the wrapped along-track gap from x to y,
 * `old` the same gap one tick earlier, `lateral` = y.lateral - x.lateral.
 * Returns {kind, force} when an impulse was applied, otherwise null.
 */
export function resolveContact(x,y,dx,old,lateral,tieBreak){
  const sign=Math.abs(lateral)>.02?Math.sign(lateral):tieBreak;
  const crossed=Math.sign(dx)!==Math.sign(old)&&Math.abs(old)<12;
  const along=(CONTACT_LENGTH-Math.abs(dx))/CONTACT_LENGTH,across=(CONTACT_WIDTH-Math.abs(lateral))/CONTACT_WIDTH;
  // Vendor contract, kept for every contact: hulls never stay overlapping sideways.
  const mass=x.ship.armor+y.ship.armor,overlap=CONTACT_WIDTH-Math.abs(lateral);
  x.lateral=clamp(x.lateral-sign*overlap*y.ship.armor/mass,-WALL,WALL);
  y.lateral=clamp(y.lateral+sign*overlap*x.ship.armor/mass,-WALL,WALL);
  if(crossed||along<across){
    // Nose to tail: the ship behind loses speed; the one in front only wobbles.
    const ahead=(old||dx)>0?y:x,behind=ahead===y?x:y;
    const closing=behind.speed-ahead.speed;
    const glance=sideImpulse(x,y,sign,MIN_SEPARATION*.5);
    if(closing<=0)return glance>0?{kind:'side',force:glance}:null;
    behind.speed=Math.max(0,ahead.speed-closing*REAR_BOUNCE);
    const k=Math.min(1,closing/30);
    ahead.yawRate+=sign*(ahead===y?1:-1)*YAW_KICK*k;
    behind.yawRate-=sign*(ahead===y?1:-1)*YAW_KICK*k*.6;
    return {kind:'rear',force:closing};
  }
  // Side swipe: bounce apart.
  const force=sideImpulse(x,y,sign,MIN_SEPARATION);
  return force>0?{kind:'side',force}:null;
}
