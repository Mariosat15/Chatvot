export function createTouchControls({root,pointers,canDrive,queueFire}){
 const pad=document.getElementById('steeringPad'),knob=pad.querySelector('i');let analog=0,stickPointer=null;
 const setting=document.getElementById('touchMode'),hand=document.getElementById('controlHand'),size=document.getElementById('controlSize'),line=document.getElementById('racingLine');
 try{size.value=localStorage.getItem('cv-control-size')||'standard';line.checked=localStorage.getItem('cv-racing-line')!=='off';}catch{}
 line.addEventListener('change',()=>{try{localStorage.setItem('cv-racing-line',line.checked?'on':'off');}catch{}});
 // CHARTVOLT PATCH (28 Sep 2026, owner): the analog pad is the default on every device, a computer
 // included. Reason: the vendor saved the mode on every load, so each computer that ever played holds
 // a stored 'buttons' it never chose; the setting moves to a new key, and only a touch device's old
 // value (which the player may have picked) is carried over.
 const MODE_KEY='cv-touch-mode-2';
 try{setting.value=localStorage.getItem(MODE_KEY)||(matchMedia('(any-pointer:coarse)').matches&&localStorage.getItem('cv-touch-mode'))||'analog';hand.value=localStorage.getItem('cv-control-hand')||'right';}catch{setting.value='analog';}
 const apply=()=>{resetAll();document.body.dataset.controls=setting.value;document.body.dataset.hand=hand.value;document.body.dataset.controlSize=size.value;try{localStorage.setItem(MODE_KEY,setting.value);localStorage.setItem('cv-control-hand',hand.value);localStorage.setItem('cv-control-size',size.value);}catch{}};
 setting.addEventListener('change',apply);hand.addEventListener('change',apply);size.addEventListener('change',apply);
 function clear(){analog=0;stickPointer=null;pad.classList.remove('pressed');knob.style.transform='translate(-50%,-50%)';}
 function resetAll(){clear();pointers.clear();root.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
 function steer(event){const box=pad.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(event.clientX-box.x-box.width/2)/(box.width*.37)));analog=Math.abs(x)<.06?0:Math.sign(x)*(Math.abs(x)-.06)/.94;knob.style.transform=`translate(calc(-50% + ${x*box.width*.3}px),-50%)`;}
 pad.addEventListener('pointerdown',event=>{if(!canDrive()||stickPointer!==null)return;event.preventDefault();stickPointer=event.pointerId;pad.setPointerCapture(event.pointerId);pad.classList.add('pressed');steer(event);});
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
 // Safari/embedded browsers can cancel the touch gesture before forwarding a
 // final PointerEvent. Release every action when that gesture is cancelled.
 root.addEventListener('touchcancel',resetAll,{passive:true});
 root.addEventListener('touchend',event=>{if(event.touches.length===0)resetAll();},{passive:true});
 apply();return {clear:resetAll,read:()=>({steer:analog,boostAccelerates:[...pointers.values()].includes('boost')})};
}
