export function createTouchControls({root,pointers,canDrive,queueFire}){
 const pad=document.getElementById('steeringPad'),knob=pad.querySelector('i');let analog=0,stickPointer=null;
 const setting=document.getElementById('touchMode'),hand=document.getElementById('controlHand'),size=document.getElementById('controlSize'),line=document.getElementById('racingLine');
 try{size.value=localStorage.getItem('cv-control-size')||'standard';line.checked=localStorage.getItem('cv-racing-line')!=='off';}catch{}
 line.addEventListener('change',()=>{try{localStorage.setItem('cv-racing-line',line.checked?'on':'off');}catch{}});
 // CHARTVOLT PATCH (28 Sep 2026, owner): the analog pad is the default on every device, a computer
 // included. Reason: the vendor saved the mode on every load, so each computer that ever played holds
 // a stored 'buttons' it never chose; the setting moves to a new key, and only a touch device's old
 // value (which the player may have picked) is carried over.
 // CHARTVOLT PATCH (14 Oct 2026, owner: "in mobile by default have the left/right buttons"): a touch
 // device now defaults to the steering buttons; a computer keeps the analog default. The key moves again
 // for the same reason as before - every phone that played since 28 Sep holds a stored 'analog' it never
 // chose - so a player who picks a mode from now on keeps it.
 const MODE_KEY='cv-touch-mode-3';
 const defaultMode=()=>matchMedia('(any-pointer:coarse)').matches?'buttons':'analog';
 try{setting.value=localStorage.getItem(MODE_KEY)||defaultMode();hand.value=localStorage.getItem('cv-control-hand')||'right';}catch{setting.value=defaultMode();}
 const apply=()=>{resetAll();document.body.dataset.controls=setting.value;document.body.dataset.hand=hand.value;document.body.dataset.controlSize=size.value;try{localStorage.setItem(MODE_KEY,setting.value);localStorage.setItem('cv-control-hand',hand.value);localStorage.setItem('cv-control-size',size.value);}catch{}};
 setting.addEventListener('change',apply);hand.addEventListener('change',apply);size.addEventListener('change',apply);
 function clear(){analog=0;stickPointer=null;pad.classList.remove('pressed');knob.style.transform='translate(-50%,-50%)';}
 function resetAll(){clear();pointers.clear();root.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
 /* CHARTVOLT PATCH (13 Oct 2026, owner: "the mobile joystick is very slow responsive"): full lock needed the thumb 37% of the pad's width out from centre with a linear response, so a thumb-sized nudge barely turned. Full lock is now 26% out, the dead zone 4%, and the response curve (power .7) gives more turn for small movements while still reaching exactly 1 at full lock. */
 /* CHARTVOLT PATCH (13 Oct 2026, owner: still "late response" on the analog): the pad's box is read once when the thumb lands, not on every move. getBoundingClientRect after the knob's transform was written forces a synchronous layout on each pointermove, which on a phone delayed the very input the stick exists to deliver. */
 let box=null;
 function steer(event){box??=pad.getBoundingClientRect();const x=Math.max(-1,Math.min(1,(event.clientX-box.x-box.width/2)/(box.width*.26))),m=Math.abs(x);analog=m<.04?0:Math.sign(x)*Math.pow((m-.04)/.96,.7);knob.style.transform=`translate(calc(-50% + ${x*box.width*.26}px),-50%)`;}
 pad.addEventListener('pointerdown',event=>{if(!canDrive()||stickPointer!==null)return;event.preventDefault();stickPointer=event.pointerId;box=pad.getBoundingClientRect();pad.setPointerCapture(event.pointerId);pad.classList.add('pressed');steer(event);});
 pad.addEventListener('pointermove',event=>{if(event.pointerId===stickPointer){event.preventDefault();steer(event);}});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,event=>{if(event.pointerId===stickPointer)clear();});
 root.querySelectorAll('[data-action]').forEach(button=>{
  button.addEventListener('pointerdown',event=>{if(!canDrive()||button.disabled)return;event.preventDefault();button.setPointerCapture(event.pointerId);pointers.set(event.pointerId,button.dataset.action);if(button.dataset.action==='fire')queueFire();button.classList.add('pressed');});
  // Captured throttle/boost touches may slide between the adjacent buttons.
  // Each finger retains its own action; a second finger cannot release it.
  if(['throttle','boost'].includes(button.dataset.action))button.addEventListener('pointermove',event=>{
   if(!pointers.has(event.pointerId)||!['throttle','boost'].includes(pointers.get(event.pointerId)))return;
   const next=[...root.querySelectorAll('[data-action=throttle],[data-action=boost]')].find(b=>{const r=b.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;});
   if(next){pointers.set(event.pointerId,next.dataset.action);for(const b of root.querySelectorAll('[data-action=throttle],[data-action=boost]'))b.classList.toggle('pressed',[...pointers.values()].includes(b.dataset.action));}
  });
  const release=event=>{pointers.delete(event.pointerId);root.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('pressed',[...pointers.values()].includes(b.dataset.action)));};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,release);
 });
 root.addEventListener('contextmenu',event=>event.preventDefault());
 /* CHARTVOLT PATCH (13 Oct 2026, owner: "view must be uninterrupted ... when scroll to end while play game the game crashes"): during a race no touch may scroll or rubber-band anything - inside this frame or, through scroll chaining, the page hosting it. The hangar keeps its scrolling lists. */
 // CHARTVOLT PATCH (14 Oct 2026, owner: "no way to scroll the menu"): an open dialog (settings, pause
 // menu) is the one thing that must still scroll mid-race, or its lower items and its exits are unreachable.
 document.addEventListener('touchmove',event=>{const state=document.body.dataset.state;if(event.target?.closest?.('dialog[open]'))return;if(state&&state!=='hangar'&&event.cancelable)event.preventDefault();},{passive:false});
 // Safari/embedded browsers can cancel the touch gesture before forwarding a
 // final PointerEvent. Release every action when that gesture is cancelled.
 root.addEventListener('touchcancel',resetAll,{passive:true});
 root.addEventListener('touchend',event=>{if(event.touches.length===0)resetAll();},{passive:true});
 apply();return {clear:resetAll,read:()=>({steer:analog,boostAccelerates:[...pointers.values()].includes('boost')})};
}
