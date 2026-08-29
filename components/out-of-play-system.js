(()=>{'use strict';
const VERSION='0.73.0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),other=t=>t==='blue'?'red':'blue';
function boot(){
  const e=window.FutLiveFootballEngine,br=window.FutLiveBoundaryRestarts;
  if(!e||typeof e.physics!=='function'||!e.players?.length||!br?.handle){setTimeout(boot,40);return}
  if(e.__outOfPlayV073)return;e.__outOfPlayV073=true;
  const oldPhysics=e.physics.bind(e);let lastEventAt=0;
  function active(){const flow=window.FutLiveMatchFlow;return flow?.state?.phase===flow?.PHASES?.PLAYING&&!window.FutLiveApp?.isPaused?.()}
  function stopBall(){e.ball.owner=null;e.ball.vx=e.ball.vy=0;e.ball.curve=0;e.ball.intended=null;e.ball.pickupLock=performance.now()+250}
  function emit(kind,team,x,y,side){const now=performance.now();if(now-lastEventAt<220)return false;lastEventAt=now;stopBall();window.FutLiveApp?.setPaused?.(true);e.ball.x=x;e.ball.y=y;e.paint?.();const detail={kind,team,x,y,side};const handled=br.handle(detail)===true;window.dispatchEvent(new CustomEvent('futlive:outofplay',{detail:{...detail,exactRestart:handled,authority:'boundary-restart-system'}}));return true}
  function detect(dt,f){if(!active())return false;const b=e.ball,last=b.owner||b.lastTouch,lastTeam=last?.team||null,nx=b.owner?b.x:b.x+b.vx*dt,ny=b.owner?b.y:b.y+b.vy*dt,crossTop=ny<f.top||b.y<f.top,crossBottom=ny>f.bottom||b.y>f.bottom;if(crossTop||crossBottom){const side=crossTop?'top':'bottom',team=lastTeam?other(lastTeam):(b.x<(f.left+f.right)/2?'red':'blue');return emit('throw-in',team,clamp(b.x,f.left+2,f.right-2),side==='top'?f.top:f.bottom,side)}const crossLeft=nx<f.left||b.x<f.left,crossRight=nx>f.right||b.x>f.right;if(!crossLeft&&!crossRight)return false;const cy=clamp(b.y+b.vy*dt,f.top,f.bottom);if(cy>=f.goalTop&&cy<=f.goalBottom)return false;const side=crossLeft?'left':'right',defending=side==='left'?'blue':'red';return lastTeam===defending?emit('corner',other(defending),side==='left'?f.left:f.right,cy,side):emit('goal-kick',defending,side==='left'?f.left:f.right,cy,side)}
  e.physics=(dt,f)=>{if(detect(dt,f))return;return oldPhysics(dt,f)};
  window.FutLiveOutOfPlay={version:VERSION,authority:'boundary-restart-system',isBusy:()=>window.FutLiveSetPieces?.state?.busy||false};
}
boot();
})();