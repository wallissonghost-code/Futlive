(()=>{'use strict';
const VERSION='0.60.2';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const other=t=>t==='blue'?'red':'blue';
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||typeof e.physics!=='function'||!e.players?.length){setTimeout(boot,40);return}
  if(e.__outOfPlayV0602)return;e.__outOfPlayV0602=true;
  const oldPhysics=e.physics.bind(e);
  let lastEventAt=0;
  function active(){const flow=window.FutLiveMatchFlow;return flow?.state?.phase===flow?.PHASES?.PLAYING&&!window.FutLiveApp?.isPaused?.()}
  function stopBall(){e.ball.owner=null;e.ball.vx=0;e.ball.vy=0;e.ball.curve=0;e.ball.intended=null;e.ball.pickupLock=performance.now()+250}
  function emit(kind,team,x,y,side){
    const now=performance.now();if(now-lastEventAt<220)return false;lastEventAt=now;
    stopBall();window.FutLiveApp?.setPaused?.(true);
    e.ball.x=x;e.ball.y=y;e.paint?.();
    window.dispatchEvent(new CustomEvent('futlive:outofplay',{detail:{kind,team,x,y,side}}));
    return true
  }
  function detect(dt,f){
    if(!active())return false;
    const b=e.ball,last=e.ball.owner||e.ball.lastTouch,lastTeam=last?.team||null;
    const nx=b.owner?b.x:b.x+b.vx*dt,ny=b.owner?b.y:b.y+b.vy*dt;
    const crossedTop=ny<f.top||b.y<f.top,crossedBottom=ny>f.bottom||b.y>f.bottom;
    if(crossedTop||crossedBottom){
      const side=crossedTop?'top':'bottom';
      const team=lastTeam?other(lastTeam):(b.x<(f.left+f.right)/2?'red':'blue');
      const x=clamp(b.x,f.left+24,f.right-24),y=side==='top'?f.top:f.bottom;
      return emit('throw-in',team,x,y,side)
    }
    const crossedLeft=nx<f.left||b.x<f.left,crossedRight=nx>f.right||b.x>f.right;
    if(!crossedLeft&&!crossedRight)return false;
    const cy=b.y+b.vy*dt;
    if(cy>=f.goalTop&&cy<=f.goalBottom)return false;
    const side=crossedLeft?'left':'right',defending=side==='left'?'blue':'red';
    if(lastTeam===defending)return emit('corner',other(defending),side==='left'?f.left:f.right,clamp(cy,f.top,f.bottom),side);
    return emit('goal-kick',defending,side==='left'?f.left:f.right,clamp(cy,f.top,f.bottom),side)
  }
  e.physics=(dt,f)=>{if(detect(dt,f))return;return oldPhysics(dt,f)};
  window.FutLiveOutOfPlay={version:VERSION,isBusy:()=>window.FutLiveSetPieces?.state?.busy||false};
}
boot();
})();