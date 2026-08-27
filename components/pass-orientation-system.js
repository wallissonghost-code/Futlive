(()=>{'use strict';
const VERSION='0.61.1';
const now=()=>performance.now();
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||!e.players?.length||typeof e.pass!=='function'){setTimeout(boot,45);return}
  if(e.__passOrientationV0611)return;e.__passOrientationV0611=true;
  const rawPass=e.pass.bind(e);
  const pending=new Map();
  const phasePlayable=()=>!window.FutLiveMatchState?.phase||window.FutLiveMatchState.phase==='PLAYING';
  function dirTo(c,t){
    const dx=t.x-c.x,dy=(t.y+27)-(c.y+27);
    if(Math.abs(dx)>=Math.abs(dy)*1.10)return dx>=0?'right':'left';
    return dy>=0?'down':'up';
  }
  function opposite(a,b){return(a==='left'&&b==='right')||(a==='right'&&b==='left')||(a==='up'&&b==='down')||(a==='down'&&b==='up')}
  function forceFacing(c,dir){
    c.facing=dir;c.lastDir=dir;
    if(c.aiVelocity){c.aiVelocity.x*=.14;c.aiVelocity.y*=.14}
    c.ctrl?.cancelPendingDirection?.();
    if(c.ctrl?.play)c.ctrl.play(dir,c.ctrl.fps||8,{restart:false});
    else c.ctrl?.move?.(dir);
  }
  function delayFor(c,dir){
    const current=c.facing||c.lastDir||dir;
    if(current===dir)return 120;
    if(opposite(current,dir))return 330;
    return 230;
  }
  e.pass=(c,t)=>{
    if(!c||!t)return rawPass(c,t);
    if(!phasePlayable()||window.FutLiveSetPieces?.state?.busy)return rawPass(c,t);
    if(e.ball.owner!==c)return rawPass(c,t);
    if(pending.has(c))return false;
    const desired=dirTo(c,t),delay=delayFor(c,desired),started=now();
    forceFacing(c,desired);
    c.aiPreparingPass=true;
    c.nextThink=Math.max(c.nextThink||0,started+delay+360);
    e.actionLock=Math.max(e.actionLock||0,started+delay+130);
    c.aiPassOrientation={direction:desired,target:t.el?.id||null,startedAt:started,delay,stage:'SET_BODY'};
    const timer=setTimeout(()=>{
      pending.delete(c);
      c.aiPreparingPass=false;
      if(!phasePlayable()||window.FutLiveSetPieces?.state?.busy)return;
      if(e.ball.owner!==c||c.sentOff||c.tempSuspended||t.sentOff)return;
      const finalDir=dirTo(c,t);
      forceFacing(c,finalDir);
      c.aiPassOrientation={direction:finalDir,target:t.el?.id||null,completedAt:now(),delay,stage:'STRIKE'};
      rawPass(c,t);
    },delay);
    pending.set(c,timer);
    return true;
  };
  const clear=()=>{for(const [p,timer] of pending){clearTimeout(timer);p.aiPreparingPass=false}pending.clear()};
  window.addEventListener('futlive:matchrestart',clear);
  window.addEventListener('futlive:matchphase',ev=>{if(ev.detail?.phase==='PLAYING')return;clear()});
  window.FutLivePassOrientation={version:VERSION,pending,dirTo,debug:p=>p?.aiPassOrientation||null};
}
boot();
})();