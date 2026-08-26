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
  // As camadas seguintes carregam depois deste arquivo. Esperamos por elas, mas nunca indefinidamente.
  waitForLayers(e,game,pauseBtn,status,performance.now());
}
function waitForLayers(e,game,pauseBtn,status,started){
  const ready=!!window.FutLiveEmotionSystem&&!!window.FutLiveBallContact&&!!window.FutLiveTackleSystem;
  if(!ready&&performance.now()-started<1200){setTimeout(()=>waitForLayers(e,game,pauseBtn,status,started),30);return}
  state.layersReady=ready;setupStage(e,game,pauseBtn,status)
}
function setupStage(e,game,pauseBtn,status){
  const f=e.field(),targets=new Map();for(const p of e.players)targets.set(p,{x:f.w*p.home[0],y:f.h*p.home[1]});
  state.playPinGoalkeeper=e.pinGoalkeeper.bind(e);e.pinGoalkeeper=()=>{};
  const lanes=[-.23,-.08,.08,.23,0];
  for(const p of e.players){const sign=p.team==='blue'?-1:1,slotLane=lanes[p.slot]||0;p.x=f.w*.5+sign*(p.goalkeeper?58:34);p.y=f.h*(.5+slotLane);p.lastDir='idle';p.facing=p.team==='blue'?'left':'right';p.ctrl.idle()}
  e.ball.owner=null;e.ball.type='free';e.ball.vx=e.ball.vy=0;e.ball.curve=0;e.ball.x=(f.left+f.right)/2;e.ball.y=(f.top+f.bottom)/2;e.paint();
  setTimeout(()=>position(e,game,pauseBtn,targets,status),550);
}
function position(e,game,pauseBtn,targets,status){
  setPhase(PHASES.POSITIONING);if(status)status.textContent='⏱ 00:00 · POSICIONANDO';let last=performance.now(),stable=0,start=performance.now();
  function frame(t){if(state.phase!==PHASES.POSITIONING)return;const dt=Math.min(.04,(t-last)/1000||.016);last=t;let max=0;
    for(const p of e.players){const q=targets.get(p),d=Math.hypot(q.x-p.x,q.y-p.y);max=Math.max(max,d);e.moveToward(p,q.x,q.y,p.goalkeeper?p.speed*.86:p.speed*.92,dt)}
    const f=e.field();e.ball.x=(f.left+f.right)/2;e.ball.y=(f.top+f.bottom)/2;e.ball.vx=e.ball.vy=0;e.paint();stable=max<5?stable+1:0;
    // Nunca permite posicionamento infinito: ao chegar ou após 3.2 s segue para READY.
    if(stable>5||performance.now()-start>3200){ready(e,game,pauseBtn,status);return}requestAnimationFrame(frame)}requestAnimationFrame(frame)
}
function ready(e,game,pauseBtn,status){
  if(state.phase===PHASES.READY||state.phase===PHASES.PLAYING)return;
  if(state.playPinGoalkeeper)e.pinGoalkeeper=state.playPinGoalkeeper;setPhase(PHASES.READY);const f=e.field();
  for(const p of e.players){p.x=f.w*p.home[0];p.y=f.h*p.home[1];p.lastDir='idle';p.ctrl.idle()}e.ball.owner=null;e.ball.x=(f.left+f.right)/2;e.ball.y=(f.top+f.bottom)/2;e.ball.vx=e.ball.vy=0;e.paint();if(status)status.textContent='⏱ 00:00 · PRONTO';
  setTimeout(()=>startPlaying(e,game,pauseBtn,status),700)
}
function startPlaying(e,game,pauseBtn,status){
  if(state.phase===PHASES.PLAYING)return;setPhase(PHASES.PLAYING);state.startedAt=performance.now();if(status)status.textContent='⏱ 00:00 · PAINEL';if(game.classList.contains('is-paused'))pauseBtn.click()
}
// Fail-safe global: mesmo se alguma camada externa falhar, o jogo nunca fica preso no pré-jogo.
setTimeout(()=>{if(state.initialized&&state.phase!==PHASES.PLAYING){const e=window.FutLiveFootballEngine,game=document.getElementById('game'),pauseBtn=document.getElementById('pauseBtn'),status=document.querySelector('.scorebox small');if(e&&game&&pauseBtn)startPlaying(e,game,pauseBtn,status)}},6000);
window.FutLiveMatchFlow={state,PHASES,setPhase,isPlaying:()=>state.phase===PHASES.PLAYING};boot();
})();