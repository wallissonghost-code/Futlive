(()=>{'use strict';
const VERSION='0.61.1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const other=t=>t==='blue'?'red':'blue';
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||typeof e.physics!=='function'||!e.players?.length){setTimeout(boot,40);return}
  if(e.__outOfPlayV0611)return;e.__outOfPlayV0611=true;
  if(!document.getElementById('futlive-sprite-render-fix')){const st=document.createElement('style');st.id='futlive-sprite-render-fix';st.textContent='.player-sprite-img{filter:none!important;-webkit-filter:none!important;backface-visibility:hidden;-webkit-backface-visibility:hidden}.player{box-shadow:none!important;background:transparent!important}';document.head.appendChild(st)}
  if(!document.querySelector('script[data-boundary-restarts]')){const s=document.createElement('script');s.dataset.boundaryRestarts='1';s.src='./components/boundary-restart-system.js?v=0.1.0-'+Date.now();document.head.appendChild(s)}
  const oldPhysics=e.physics.bind(e);
  let lastEventAt=0;
  function active(){const flow=window.FutLiveMatchFlow;return flow?.state?.phase===flow?.PHASES?.PLAYING&&!window.FutLiveApp?.isPaused?.()}
  function stopBall(){e.ball.owner=null;e.ball.vx=0;e.ball.vy=0;e.ball.curve=0;e.ball.intended=null;e.ball.pickupLock=performance.now()+250}
  function emit(kind,team,x,y,side){
    const now=performance.now();if(now-lastEventAt<220)return false;lastEventAt=now;
    stopBall();window.FutLiveApp?.setPaused?.(true);e.ball.x=x;e.ball.y=y;e.paint?.();
    const detail={kind,team,x,y,side};
    const handled=window.FutLiveBoundaryRestarts?.handle?.(detail)===true;
    window.dispatchEvent(new CustomEvent('futlive:outofplay',{detail:{...detail,exactRestart:handled}}));
    return true
  }
  function detect(dt,f){
    if(!active())return false;
    const b=e.ball,last=e.ball.owner||e.ball.lastTouch,lastTeam=last?.team||null;
    const nx=b.owner?b.x:b.x+b.vx*dt,ny=b.owner?b.y:b.y+b.vy*dt;
    const crossedTop=ny<f.top||b.y<f.top,crossedBottom=ny>f.bottom||b.y>f.bottom;
    if(crossedTop||crossedBottom){const side=crossedTop?'top':'bottom',team=lastTeam?other(lastTeam):(b.x<(f.left+f.right)/2?'red':'blue'),x=clamp(b.x,f.left+2,f.right-2),y=side==='top'?f.top:f.bottom;return emit('throw-in',team,x,y,side)}
    const crossedLeft=nx<f.left||b.x<f.left,crossedRight=nx>f.right||b.x>f.right;if(!crossedLeft&&!crossedRight)return false;
    const cy=clamp(b.y+b.vy*dt,f.top,f.bottom);if(cy>=f.goalTop&&cy<=f.goalBottom)return false;
    const side=crossedLeft?'left':'right',defending=side==='left'?'blue':'red';
    if(lastTeam===defending)return emit('corner',other(defending),side==='left'?f.left:f.right,cy,side);
    return emit('goal-kick',defending,side==='left'?f.left:f.right,cy,side)
  }
  e.physics=(dt,f)=>{if(detect(dt,f))return;return oldPhysics(dt,f)};
  window.FutLiveOutOfPlay={version:VERSION,isBusy:()=>window.FutLiveSetPieces?.state?.busy||false};
}
boot();
})();