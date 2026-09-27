(() => {
  'use strict';
  const api=window.ChartvoltTetris, bridge=window.ChartvoltCompetition;
  const $=id=>document.getElementById(id);
  let resumeAfterDialog=false;
  function openDialog(id){resumeAfterDialog=['playing','clearing','collapsing'].includes(api.getState().state);api.pause();$(id).showModal();}
  for(const [button,dialog] of [['settingsBtn','settingsDialog'],['helpBtn','helpDialog'],['leaveBtn','leaveDialog']]){
    $(button).onclick=()=>openDialog(dialog);
    $(dialog).addEventListener('close',()=>{
      if(dialog==='leaveDialog' && $(dialog).returnValue==='leave'){
        if(!['ready','over'].includes(api.getState().state))api.end();
        bridge.notify('leave',{state:api.getState()});
      }else if(resumeAfterDialog)api.resume();
    });
  }
  $('volume').oninput=e=>api.setMusicVolume(+e.target.value);
  $('effectsVolume').oninput=e=>api.setEffectsVolume(+e.target.value);
  $('musicTrack').onchange=e=>api.setMusicTrack(+e.target.value);
  $('testSound').onclick=()=>window.VoltAudio.play('tetris');
  $('quality').onchange=e=>api.setQuality(e.target.value);
  $('motion').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function motion(){document.body.classList.toggle('reduced-motion',$('motion').checked);if($('motion').checked)api.setQuality('low');else api.setQuality($('quality').value);}
  $('motion').onchange=motion;motion();api.setMusicVolume(.65);
  $('retryResult').onclick=async()=>{try{await bridge.retryFinalize()}catch{}};
  new ResizeObserver(()=>window.dispatchEvent(new Event('resize'))).observe(document.querySelector('.board-wrap'));
  bridge.notify('ready',{game:'neon-stack',engineVersion:'9.4'});
})();
