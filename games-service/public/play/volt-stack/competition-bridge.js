/* ChartVolt Neon Stack host adapter v8. No network calls in practice mode. */
(() => {
  'use strict';
  let config = {mode:'practice', parentOrigin:location.origin}, adapter = null, current = null;
  let pendingResult = null, receipt = null, sending = false;
  const deadline = (promise, ms=12000) => new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error('ChartVolt connection timed out.')),ms);
    Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)});
  });
  function notify(type, data={}) {
    const message={channel:'chartvolt:neon-stack',version:8,type,...data};
    window.dispatchEvent(new CustomEvent('chartvolt:host',{detail:message}));
    if(parent!==window && /^https?:\/\//.test(config.parentOrigin)) parent.postMessage(message,config.parentOrigin);
  }
  function status(text,retry=false){
    const el=document.getElementById('submissionStatus'); if(el)el.textContent=text;
    const btn=document.getElementById('retryResult');if(btn)btn.hidden=!retry;
  }
  window.ChartvoltCompetition = {
    configure(options={}, hostAdapter=null){
      const state=window.ChartvoltTetris?.getState().state;
      if(state && !['ready','over'].includes(state))throw new Error('Configure before starting a run.');
      if(!['practice','competition'].includes(options.mode))throw new Error('mode must be practice or competition');
      if(options.parentOrigin && !/^https?:\/\/[^/]+$/.test(options.parentOrigin))throw new Error('Use an exact parent origin');
      config={...config,...options}; adapter=hostAdapter; current=null;
      document.getElementById('modeLabel').textContent='Powered by Chartvolt';
      document.getElementById('startBtn').innerHTML=config.mode==='competition'?'JOIN COMPETITION <b>↗</b>':'PLAY PRACTICE <b>↗</b>';
      document.getElementById('startHint').textContent=config.mode==='competition'?'Host session required · results verified by ChartVolt':'Enter to start · 2 minutes per level';
      return {...config};
    },
    getConfig:()=>({...config}),
    isCompetition:()=>config.mode==='competition',
    async createSession(){
      pendingResult=null;receipt=null;
      if(config.mode==='practice')return null;
      if(!adapter?.createSession || !adapter?.finalize)throw new Error('ChartVolt competition adapter is not connected.');
      const session=await deadline(adapter.createSession({game:'neon-stack',version:8,competitionId:config.competitionId}));
      if(!session || typeof session.sessionId!=='string' || !session.token || typeof session.pieceSeed!=='string' || !session.pieceSeed || !Number.isFinite(session.endsAt) || session.endsAt<=Date.now() || !Number.isFinite(session.durationMs) || session.durationMs<1000)throw new Error('Invalid or expired ChartVolt session.');
      current=session;return {...session};
    },
    async reportEvent(event,token){
      notify('event',{event});
      if(current && adapter?.reportEvent)await deadline(adapter.reportEvent(event,token));
    },
    async finalize(result,token){
      if(!current){status('Practice result · no prize eligibility');notify('result',{result,verified:false});return {practice:true};}
      if(receipt)return receipt;
      if(sending)throw new Error('Submission already in progress');
      pendingResult={result,token,sessionId:current.sessionId};sending=true;
      status('Submitting to ChartVolt…');notify('submission',{state:'pending'});
      try{
        const response=await deadline(adapter.finalize({...result,idempotencyKey:current.sessionId,replay:window.ChartvoltTetris.exportReplay()},token));
        if(!response || response.accepted!==true)throw new Error(response?.message||'ChartVolt has not accepted this result.');
        receipt=response;pendingResult=null;status(response.verified===true?'Result verified by ChartVolt':'Result received · awaiting verification');
        notify('result',{result,receipt:response,verified:response.verified===true});return response;
      }catch(error){status('Result not submitted. Retry your connection.',true);notify('submission',{state:'failed',message:error.message});throw error;}
      finally{sending=false;}
    },
    retryFinalize(){return pendingResult?this.finalize(pendingResult.result,pendingResult.token):Promise.resolve(receipt)},
    hasPendingResult:()=>Boolean(pendingResult)||sending,
    notify
  };
})();
