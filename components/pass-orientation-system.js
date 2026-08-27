(()=>{'use strict';
const VERSION='0.60.3';
const now=()=>performance.now();
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||!e.players?.length||typeof e.pass!=='function'){setTimeout(boot,45);return}
  if(e.__passOrientationV0603)return;e.__passOrientationV0603=true;
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
    if(c.aiVelocity){c.aiVelocity.x*=.42;c.aiVelocity.y*=.42}
    c.ctrl?.cancelPendingDirection?.();
    if(c.ctrl?.play)c.ctrl.play(dir,c.ctrl.fps||8,{restart:false});
    else c.ctrl?.move?.(dir);
  }
  function delayFor(c,dir){
    const current=c.facing||c.lastDir||dir;
    if(current===dir)return 35;
    if(opposite(current,dir))return 210;
    return 145;
  }
  e.pass=(c,t)=>{
    if(!c||!t)return rawPass(c,t);
    if(!phasePlayable()||window.FutLiveSetPieces?.state?.busy)return rawPass(c,t);
    if(e.ball.owner!==c)return rawPass(c,t);
    if(pending.has(c))return false;
    const desired=dirTo(c,t),delay=delayFor(c,desired),started=now();
    forceFacing(c,desired);
    c.nextThink=Math.max(c.nextThink||0,started+delay+260);
    e.actionLock=Math.max(e.actionLock||0,started+delay+90);
    c.aiPassOrientation={direction:desired,target:t.el?.id||null,startedAt:started,delay};
    const timer=setTimeout(()=>{
      pending.delete(c);
      if(!phasePlayable()||window.FutLiveSetPieces?.state?.busy)return;
      if(e.ball.owner!==c||c.sentOff||c.tempSuspended||t.sentOff)return;
      const finalDir=dirTo(c,t);
      forceFacing(c,finalDir);
      c.aiPassOrientation={direction:finalDir,target:t.el?.id||null,completedAt:now(),delay};
      rawPass(c,t);
    },delay);
    pending.set(c,timer);
    return true;
  };
  window.addEventListener('futlive:matchrestart',()=>{for(const timer of pending.values())clearTimeout(timer);pending.clear()});
  window.addEventListener('futlive:matchphase',ev=>{if(ev.detail?.phase==='PLAYING')return;for(const timer of pending.values())clearTimeout(timer);pending.clear()});
  window.FutLivePassOrientation={version:VERSION,pending,dirTo,debug:p=>p?.aiPassOrientation||null};
}
boot();
})();