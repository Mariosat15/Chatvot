export const SHIPS=[
  {id:'vanguard',name:'VANGUARD',color:0x51e5fa,subtitle:'Interceptor / balanced',speed:112,acceleration:32,handling:25,armor:1,stats:[80,80,80],description:'Balanced thrust and handling. Precise, predictable and built for close racing.'},
  {id:'spectre',name:'SPECTRE',color:0xc28aff,subtitle:'Delta / top speed',speed:123,acceleration:26,handling:21,armor:.87,stats:[95,65,65],description:'High straight-line speed with lighter armor. Brake early for technical corners.'},
  {id:'pulse',name:'PULSE',color:0xffbc52,subtitle:'Split hull / agility',speed:107,acceleration:36,handling:30,armor:1,stats:[70,90,93],description:'Independent outriggers and four thrusters. Quick out of technical corners.'},
  {id:'raptor',name:'RAPTOR',color:0xff795f,subtitle:'Pursuit / acceleration',speed:110,acceleration:39,handling:26,armor:.88,stats:[76,98,82],description:'An aggressive pursuit chassis. Rapid launches with lighter armor.'},
  {id:'bastion',name:'BASTION',color:0x9cf27b,subtitle:'Heavy / armor',speed:108,acceleration:29,handling:24,armor:1.28,stats:[72,72,72],description:'Armored transport chassis. Takes more punishment; demands earlier braking.'},
  {id:'wraith',name:'WRAITH',color:0xcc9bff,subtitle:'Precision / handling',speed:110,acceleration:32,handling:32,armor:.9,stats:[76,80,99],description:'Light fighter architecture. Precise turn-in and a compact profile.'},
  {id:'comet',name:'COMET',color:0xffdf75,subtitle:'Sprint / velocity',speed:124,acceleration:27,handling:23,armor:.85,stats:[98,68,70],description:'A long-range speed machine. Exceptional straights, deliberate corners.'},
  {id:'tempest',name:'TEMPEST',color:0x7effdb,subtitle:'Experimental / boost',speed:111,acceleration:31,handling:27,armor:1,boostExtra:44,boostDrain:.27,stats:[78,77,85],description:'Vector-wing prototype. Stronger boost at a higher energy cost.'}
];
export const SHIP_TRADEOFFS={
 vanguard:['Balanced acceleration, grip and durability','No specialist speed, handling or armor advantage'],
 spectre:['443 km/h top speed','87 hull points; slower acceleration and wider turns'],
 pulse:['Fast acceleration and strong cornering','385 km/h top speed: the slowest on long straights'],
 raptor:['Fastest acceleration in the fleet','88 hull points; lower top speed than the sprinters'],
 bastion:['128 hull points: strongest damage resistance','Lower top speed, acceleration and turning response'],
 wraith:['Sharpest steering response','90 hull points and modest straight-line speed'],
 comet:['446 km/h: highest unboosted top speed','85 hull points: least durable; slower acceleration'],
 tempest:['Strongest boost speed increase','Boost drains faster: 3.7 s versus about 4.5 s']
};
export function shipMetrics(s){return {topSpeedKmh:Math.round(s.speed*3.6),acceleration:s.acceleration,handling:s.handling,hullPoints:Math.round(100*s.armor),boostSeconds:Number((1/(s.boostDrain||.22)).toFixed(1))};}
export const ITEMS={energy:{name:'ENERGY',color:0x5aeeff,icon:'ϟ',description:'Refills 40% boost'},repair:{name:'REPAIR',color:0x5df0a4,icon:'+',description:'Restores 30% hull'},shield:{name:'SHIELD',color:0x6cabff,icon:'◇',description:'Six seconds of protection'},overdrive:{name:'OVERDRIVE',color:0xffc05b,icon:'»',description:'Five seconds of engine overdrive'},missile:{name:'MISSILE',color:0xff6d91,icon:'↑',description:'Locks onto a hazard ahead'},emp:{name:'EMP',color:0xc68aff,icon:'◎',description:'Clears nearby hazards and incoming bolts'},mine:{name:'PROXIMITY MINE',color:0xff9365,icon:'✳',description:'Deploys an interceptor charge ahead'},counter:{name:'COUNTERMEASURE',color:0x8ffff1,icon:'≋',description:'Clears incoming bolts and jams locks'},shockwave:{name:'SHOCKWAVE',color:0x4dfff0,icon:'\u25CE',description:'Blasts nearby racers sideways'},slick:{name:'OIL SLICK',color:0xd8ff3d,icon:'\u2248',description:'Drops a slick that spins out a chaser'},seeker:{name:'SEEKER',color:0xff3dbb,icon:'\u27A4',description:'Homing missile that hunts the racer ahead'},cloak:{name:'CLOAK',color:0x9d8cff,icon:'\u25D0',description:'Four seconds no weapon can lock you'},magnet:{name:'MAGNET',color:0xff5a3d,icon:'\u2229',description:'Six seconds of wide capsule pickup'}};
export function pickupAt(index,length){const kinds=['shield','energy','missile','repair','overdrive','emp'];return {distance:length*(index+.45)/24,lane:(index%3-1)*7,kind:kinds[index%6]};}
export function hazardAt(index,length){return {distance:length*(index+.85)/12,lane:((index+1)%3-1)*7};}
