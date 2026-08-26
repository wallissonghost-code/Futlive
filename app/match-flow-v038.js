(()=>{'use strict';
const PHASES=Object.freeze({PRE_MATCH:'PRE_MATCH',POSITIONING:'POSITIONING',READY:'READY',PLAYING:'PLAYING'});
const state=window.FutLiveMatchState||{phase:PHASES.PRE_MATCH,startedAt:0};
state.phase=PHASES.PRE_MATCH;state.PHASES=PHASES;window.FutLiveMatchState=state;
function setPhase(phase){state.phase=phase;state.changedAt=performance.now();document.documentElement.dataset.matchPhase=phase;window.dispatchEvent(new CustomEvent('futlive:matchphase',{detail:{phase}}))}
function boot(){
  const e=window.FutLiveFootballEngine,app=window.FutLiveApp,game=document.getElementById('game'),pauseBtn=document.getElementById('pauseBtn');
  if(!e||!app||!game||!pauseBtn||!e.players?.length){setTimeout(boot,25);return}
  if(state.initialized)return;state.initialized=true;
  if(!game.classList.contains('is-paused'))pauseBtn.click();
  e.score={blue:0,red:0};e.renderScore();setPhase(PHASES.PRE_MATCH);
  const status=document.querySelector('.scorebox small');if(status)status.textContent='⏱ 00:00 · PRÉ-JOGO';
  waitForLayers(e,game,pauseBtn,status);
}
function waitForLayers(e,game,pauseBtn,status){
  if(!window.FutLiveEmotionSystem||!window.FutLiveBallContact||!window.FutLiveTackleSystem){setTimeout(()=>waitForLayers(e,game,pauseBtn,status),30);return}
  setupStage(e,game,pauseBtn,status)
}
function setupStage(e,game,pauseBtn,status){
  const f=e.field(),targets=new Map();for(const p of e.players)targets.set(p,{x:f.w*p.home[0],y:f.h*p.home[1]});
  state.playPinGoalkeeper=e.pinGoalkeeper.bind(e);e.pinGoalkeeper=()=>{};
  const lanes=[-.23,-.08,.08,.23,0];
  for(const p of e.players){const sign=p.team==='blue'?-1:1,slotLane=lanes[p.slot]||0;p.x=f.w*.5+sign*(p.goalkeeper?58:34);p.y=f.h*(.5+slotLane);p.lastDir='idle';p.facing=p.team==='blue'?'left':'right';p.ctrl.idle()}
  e.ball.owner=null;e.ball.type='free';e.ball.vx=e.ball.vy=0;e.ball.curve=0;e.ball.x=(f.left+f.right)/2;e.ball.y=(f.top+f.bottom)/2;e.paint();
  setTimeout(()=>position(e,game,pauseBtn,targets,status),650);
}
function position(e,game,pauseBtn,targets,status){
  setPhase(PHASES.POSITIONING);if(status)status.textContent='⏱ 00:00 · POSICIONANDO';let last=performance.now(),stable=0;
  function frame(t){if(state.phase!==PHASES.POSITIONING)return;const dt=Math.min(.04,(t-last)/1000||.016);last=t;let max=0;
    for(const p of e.players){const q=targets.get(p),d=Math.hypot(q.x-p.x,q.y-p.y);max=Math.max(max,d);e.moveToward(p,q.x,q.y,p.goalkeeper?p.speed*.86:p.speed*.92,dt)}
    const f=e.field();e.ball.x=(f.left+f.right)/2;e.ball.y=(f.top+f.bottom)/2;e.ball.vx=e.ball.vy=0;e.paint();stable=max<5?stable+1:0;
    if(stable>5){ready(e,game,pauseBtn,status);return}requestAnimationFrame(frame)}requestAnimationFrame(frame)
}
function ready(e,game,pauseBtn,status){
  if(state.playPinGoalkeeper)e.pinGoalkeeper=state.playPinGoalkeeper;setPhase(PHASES.READY);const f=e.field();
  for(const p of e.players){p.x=f.w*p.home[0];p.y=f.h*p.home[1];p.lastDir='idle';p.ctrl.idle()}e.ball.owner=null;e.ball.x=(f.left+f.right)/2;e.ball.y=(f.top+f.bottom)/2;e.ball.vx=e.ball.vy=0;e.paint();if(status)status.textContent='⏱ 00:00 · PRONTO';
  setTimeout(()=>{setPhase(PHASES.PLAYING);state.startedAt=performance.now();if(status)status.textContent='⏱ 00:00 · PAINEL';if(game.classList.contains('is-paused'))pauseBtn.click()},850)
}
window.FutLiveMatchFlow={state,PHASES,setPhase,isPlaying:()=>state.phase===PHASES.PLAYING};boot();
})();