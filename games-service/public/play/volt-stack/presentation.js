/* v9 visual-only effects. Never reads or mutates the board or score. */
(() => {
  'use strict';
  const bg=document.getElementById('ambientCanvas'),ctx=bg.getContext('2d');
  const wave=document.getElementById('comboWave'),g=wave.getContext('2d');
  let width=0,height=0,last=0,energy=0;
  const stars=Array.from({length:65},(_,i)=>({x:((i*123.719)%1),y:((i*93.713)%1),speed:5+i%8,size:i%7===0?2:1}));
  function resize(){width=bg.width=innerWidth;height=bg.height=innerHeight;wave.width=Math.max(70,wave.clientWidth*2);wave.height=50;}
  addEventListener('resize',resize);resize();
  addEventListener('chartvolt:tetris',e=>{
    if(/clear|combo|level/.test(e.detail.type)){energy=1;document.body.classList.add('celebration');setTimeout(()=>document.body.classList.remove('celebration'),700);}
  });
  function frame(now){
    requestAnimationFrame(frame);if(now-last<33)return;const dt=Math.min(.05,(now-last)/1000);last=now;
    const reduce=document.body.classList.contains('reduced-motion');
    ctx.clearRect(0,0,width,height);g.clearRect(0,0,wave.width,50);
    if(document.hidden)return;
    const time=reduce?0:now/1000;
    if(!reduce){
      for(const s of stars){s.y-=dt*s.speed/height;if(s.y<0)s.y=1;const x=s.x*width,y=s.y*height;ctx.globalAlpha=.3+.25*Math.sin(time+s.x*20);ctx.fillStyle='#44baff';ctx.fillRect(x,y,s.size,s.size);}
      // Slow diagonal energy streaks at the outer edges only.
      for(let i=0;i<4;i++){const y=(time*40+i*height/4)%(height+160)-160;ctx.globalAlpha=.24;ctx.strokeStyle=i%2?'#ed56ff':'#33caff';ctx.lineWidth=1.5;ctx.shadowBlur=10;ctx.shadowColor=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(i%2?width:0,y);ctx.lineTo(i%2?width-65:65,y-70);ctx.stroke();}ctx.shadowBlur=0;
    }
    energy=Math.max(0,energy-dt*.7);g.strokeStyle='#b442ff';g.shadowColor='#ad23ff';g.shadowBlur=8;g.lineWidth=1.4;g.beginPath();
    for(let x=0;x<wave.width;x+=3){const envelope=Math.pow(Math.sin(x/wave.width*Math.PI),2),amp=4+energy*12;const y=34-(Math.sin(x*.18+time*3)*Math.sin(x*.043-time*2)*amp+Math.sin(x*.07+time)*5)*envelope; x?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();
  }
  requestAnimationFrame(frame);
})();
