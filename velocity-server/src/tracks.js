import {TrackRotation} from './track-rotation.js';
// Circuit metadata. Geometry is generated from the fixed recipes below.
export const TRACKS=[
 {id:'orbital',name:'ORBITAL GATEWAY',theme:'station',difficulty:1,color:0x53e6ff,accent:0xa16cff},
 {id:'skyline',name:'NEON SKYLINE',theme:'city',difficulty:2,color:0xf078d9,accent:0x58d9ff},
 {id:'asteroid',name:'ASTEROID RUN',theme:'rock',difficulty:3,color:0xffb657,accent:0x67e9ee},
 {id:'reactor',name:'REACTOR RING',theme:'factory',difficulty:3,color:0x8ef880,accent:0xfcb253},
 {id:'solar',name:'SOLAR FLARE',theme:'solar',difficulty:1,color:0xffae60,accent:0xff6e8c},
 {id:'frozen',name:'FROZEN RELAY',theme:'ice',difficulty:2,color:0xa3ecff,accent:0x839fff},
 {id:'canyon',name:'CRIMSON CANYON',theme:'canyon',difficulty:3,color:0xff876d,accent:0xf5cd81},
 {id:'foundry',name:'GRAVITY FOUNDRY',theme:'factory',difficulty:3,color:0xb79aff,accent:0xff9c58},
 {id:'eclipse',name:'ECLIPSE PASSAGE',theme:'night',difficulty:2,color:0x8b9dff,accent:0xff74d9},
 {id:'jungle',name:'EMERALD CANOPY',theme:'jungle',difficulty:2,color:0x79ffaf,accent:0xf6d27e},
 {id:'volcano',name:'CALDERA IGNITION',theme:'volcano',difficulty:3,color:0xff7438,accent:0xffd581},
 {id:'alpine',name:'ALPINE ASCENT',theme:'alpine',difficulty:3,color:0xc6f5ff,accent:0x83a4ff},
 {id:'coast',name:'AZURE ARCHIPELAGO',theme:'coast',difficulty:2,color:0x4fffe5,accent:0xffcf8a},
 {id:'desert',name:'DUNE SERPENT',theme:'desert',difficulty:3,color:0xffc778,accent:0xee7965},
 {id:'grandprix',name:'VOLT GRAND PRIX',theme:'city',difficulty:3,color:0x62ffce,accent:0x74a4ff},
 // CHARTVOLT PATCH (28 Sep 2026, owner: "create more beautiful tracks"). Appended, never inserted:
 // layouts[] is matched by index, and the ChartVolt "auto" pick draws from a frozen list of the
 // first fifteen ids (games-service AUTO_TRACK_POOL), so these three are chosen by name only.
 {id:'aurora',name:'AURORA HIGHWAY',theme:'ice',difficulty:2,color:0x6dffc8,accent:0xb58cff},
 {id:'harbor',name:'NEON HARBOUR',theme:'city',difficulty:2,color:0xff5fb7,accent:0x49e3ff},
 {id:'nebula',name:'NEBULA DRIFT',theme:'rock',difficulty:3,color:0xc07bff,accent:0x5dfff0}
];
export function rng(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function shuffledTracks(seed){const a=TRACKS.map(t=>t.id),r=rng(seed);for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// Authored, non-radial control polygons. Each course has its own racing rhythm:
// long overtaking straights, linked esses, tightening returns and broad elevation
// transitions. Closed cubic B-splines keep position/tangent/curvature continuous.
export const ROUTE_VERSION='circuits-8';
const layouts=[
 // Orbital: fast launch straight, infield dogleg, two broad return corners.
 {scale:82, rise:1, label:'Launch straight · infield esses · orbital climb', p:[[0,0,34],[4,0,34],[8,0,38],[11,1,48],[13,4,68],[12,7,76],[9,8,68],[7,7,50],[6,5,38],[3,5,32],[1,7,42],[-2,8,54],[-5,6,62],[-5,3,48],[-3,0,34]]},
 // Skyline: asymmetric metropolitan circuit wrapping around a central district.
 {scale:83, rise:1.35,label:'Boulevard sprint · double apex · skyline descent',p:[[-7,-5,32],[-3,-5,32],[1,-5,40],[5,-5,52],[8,-3,78],[8,0,90],[6,2,82],[3,2,58],[1,4,40],[3,7,34],[2,10,42],[-1,11,70],[-4,9,94],[-4,6,84],[-6,4,62],[-9,4,48],[-11,1,34],[-10,-3,32]]},
 {scale:85,rise:1.25,label:'Rock canyon · linked esses · high ridge return',p:[[-9,-6,35],[-5,-6,35],[-1,-6,45],[3,-7,66],[7,-5,93],[9,-2,110],[8,1,106],[5,3,86],[6,6,70],[4,9,53],[0,10,38],[-3,8,46],[-2,5,64],[-4,3,93],[-7,4,110],[-10,3,100],[-12,0,65],[-11,-4,35]]},
 {scale:81,rise:1.1,label:'Reactor sweep · service-lane chicane · cooling climb',p:[[-8,-5,36],[-4,-5,36],[0,-5,36],[4,-5,42],[8,-3,62],[10,0,84],[8,3,92],[5,3,85],[3,1,68],[0,1,51],[-2,3,39],[0,6,47],[-1,9,66],[-4,11,82],[-8,10,87],[-10,7,67],[-10,3,44],[-11,-1,36]]},
 {scale:84,rise:1.1,label:'Sunrise straight · valley sweep · summit crest',p:[[-8,-3,36],[-4,-3,36],[0,-3,39],[4,-3,50],[8,-1,80],[10,2,102],[9,6,98],[5,8,78],[2,7,50],[0,4,40],[-3,4,47],[-5,7,70],[-8,8,88],[-11,6,80],[-12,2,53],[-11,-1,36]]},
 {scale:83,rise:1.5,label:'Glacier slalom · ice shelf · relay hairpin',p:[[-8,-6,40],[-4,-6,40],[0,-6,48],[3,-4,75],[5,-1,108],[8,0,130],[10,3,140],[9,7,115],[6,9,78],[3,8,53],[2,5,42],[-1,4,62],[-4,6,90],[-5,9,124],[-8,10,135],[-11,7,118],[-11,3,90],[-9,0,62],[-10,-3,40]]},
 {scale:86,rise:1.3,label:'Mesa traverse · canyon switchbacks · river descent',p:[[-10,-7,35],[-6,-7,35],[-2,-7,47],[1,-5,76],[2,-2,110],[5,-1,138],[8,-3,146],[11,-1,128],[12,3,90],[9,6,56],[5,7,40],[2,5,54],[0,7,87],[-1,10,117],[-5,12,145],[-9,10,131],[-11,6,93],[-10,2,61],[-12,-2,35]]},
 {scale:84,rise:1.3,label:'Freight straight · twin hairpins · furnace descent',p:[[-9,-6,40],[-5,-6,40],[-1,-6,46],[3,-6,64],[7,-4,92],[9,-1,122],[8,3,130],[5,5,104],[2,4,78],[0,1,52],[-3,1,48],[-5,4,75],[-3,7,110],[-4,10,136],[-8,11,138],[-11,8,109],[-12,4,77],[-11,0,51]]},
 {scale:85,rise:1.1,label:'Moonlit viaduct · offset esses · eclipse loop',p:[[-9,-5,36],[-5,-5,36],[-1,-5,48],[2,-7,66],[6,-7,86],[9,-4,98],[8,0,84],[5,2,65],[4,5,48],[6,8,38],[3,11,56],[-1,11,77],[-4,8,104],[-3,5,100],[-5,3,78],[-8,4,55],[-11,2,42],[-12,-2,36]]},
 {scale:83,rise:1.25,label:'River run · canopy chicane · waterfall climb',p:[[-9,-7,38],[-5,-7,38],[-1,-7,49],[2,-5,71],[3,-2,100],[6,0,118],[9,0,119],[11,3,101],[9,6,70],[6,6,48],[4,8,37],[1,10,47],[-2,9,67],[-3,6,99],[-6,5,122],[-9,7,115],[-12,5,85],[-12,1,58],[-10,-2,38]]},
 {scale:87,rise:1.45,label:'Crater rim · magma esses · caldera drop',p:[[-10,-7,45],[-6,-7,45],[-2,-7,51],[2,-6,80],[4,-3,111],[7,-4,133],[10,-2,146],[11,2,140],[8,5,119],[5,4,90],[3,6,65],[4,9,48],[1,12,60],[-3,11,91],[-5,8,127],[-8,9,146],[-11,7,141],[-13,3,110],[-11,0,76],[-12,-4,45]]},
 {scale:88,rise:1.6,label:'Alpine climb · ridge switchbacks · summit descent',p:[[-11,-8,40],[-7,-8,40],[-3,-8,46],[0,-6,70],[1,-3,105],[4,-2,134],[7,-4,160],[11,-2,176],[12,2,173],[9,5,151],[6,4,124],[4,7,98],[5,10,65],[2,13,49],[-2,12,64],[-4,9,94],[-7,8,122],[-10,10,147],[-13,7,144],[-13,3,111],[-11,0,77],[-13,-4,45]]},
 {scale:83,rise:1.25,label:'Seafront straight · island hook · tidal esses',p:[[-10,-6,32],[-6,-6,32],[-2,-6,37],[2,-6,52],[6,-4,82],[8,-1,109],[11,1,119],[11,5,104],[8,8,71],[4,8,43],[2,5,32],[-1,5,40],[-3,8,63],[-6,10,90],[-10,9,106],[-12,6,87],[-11,2,57],[-12,-2,33]]},
 {scale:86,rise:1.25,label:'Dune straight · oasis return · sandstone slalom',p:[[-11,-7,35],[-7,-7,35],[-3,-7,42],[1,-6,63],[3,-3,90],[6,-2,118],[9,-4,125],[12,-1,106],[11,3,78],[8,5,54],[5,4,38],[3,7,48],[4,10,72],[1,13,95],[-3,12,119],[-5,9,116],[-8,8,94],[-11,10,74],[-14,7,53],[-14,3,40],[-12,0,35],[-13,-4,35]]},
 {scale:81,rise:1.2,label:'Grandstand straight · technical infield · stadium climb',p:[[-12,-7,38],[-8,-7,38],[-4,-7,38],[0,-7,47],[3,-6,68],[6,-4,95],[7,-1,112],[6,2,103],[3,3,77],[1,1,54],[0,-2,43],[-3,-3,54],[-5,-1,78],[-4,2,108],[-2,4,132],[0,6,140],[3,7,120],[4,10,91],[1,13,65],[-3,13,45],[-5,10,38],[-6,7,45],[-9,6,70],[-12,8,95],[-15,6,89],[-16,2,65],[-14,-2,40],[-14,-5,38]]},
 {scale:91,rise:1.3,label:'Polar straight · aurora sweep · glacier crest',p:[[-9,-6,38],[-5,-6,38],[-1,-6,44],[3,-6,60],[7,-5,84],[10,-2,100],[10,2,96],[7,4,78],[4,3,60],[1,4,48],[0,7,52],[2,10,70],[-1,12,92],[-5,11,104],[-8,8,90],[-9,4,66],[-12,2,50],[-12,-3,40]]},
 {scale:82,rise:1.2,label:'Dockside sprint · crane chicane · harbour-light climb',p:[[-11,-6,34],[-7,-6,34],[-3,-6,34],[1,-6,40],[5,-5,56],[8,-2,74],[8,2,80],[5,4,70],[2,3,54],[-1,4,44],[-2,7,50],[1,9,64],[3,12,78],[1,15,90],[-3,15,84],[-6,11,66],[-9,10,54],[-12,7,44],[-13,2,38],[-12,-3,34]]},
 {scale:91,rise:1.3,label:'Starfield straight · drifting esses · nebula dive',p:[[-8,-7,40],[-4,-7,40],[0,-7,48],[4,-6,70],[8,-4,96],[10,0,112],[9,4,108],[6,6,90],[6,9,72],[3,11,58],[-1,10,50],[-2,7,62],[-1,4,80],[-4,2,96],[-8,3,100],[-10,6,86],[-13,4,66],[-13,0,50],[-11,-4,40]]}
];
TRACKS.forEach((t,index)=>{const l=layouts[index];
 // One conservative fairing pass broadens only abrupt control corners; it does
 // not radialize the route or remove its authored straights and infield sections.
 const p=l.p;
 t.points=p.map(([x,z,y],i)=>{const prev=p[(i+p.length-1)%p.length],next=p[(i+1)%p.length];return [(x*.94+(prev[0]+next[0])*.03)*l.scale,30+(y-30)*l.rise,(z*.94+(prev[1]+next[1])*.03)*l.scale];});
 t.routeVersion=ROUTE_VERSION;t.startFraction=0;t.layoutLabel=l.label;
});
let rotation;
function getRotation(){if(!rotation){let storage;try{storage=localStorage;}catch{}rotation=new TrackRotation(TRACKS.map(t=>t.id),shuffledTracks,storage);}return rotation;}
export function raceConfig(options){const q=new URLSearchParams(typeof location==='undefined'?'':location.search),initial=options===undefined;
 const raw=initial?q.get('seed'):options.seed,seed=raw==null?crypto.getRandomValues(new Uint32Array(1))[0]:Number(raw)>>>0;
 const requested=initial?q.get('track'):options.trackId;
 return {trackId:getRotation().choose(seed,requested),seed,routeVersion:ROUTE_VERSION};
}
