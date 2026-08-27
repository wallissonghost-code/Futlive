(()=>{'use strict';
const RESTART_DELAY=900;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const other=t=>t==='blue'?'red':'blue';
let busy=false,restartTimer=null;
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||typeof e.physics!=='function'||!e.players?.length){setTimeout(boot,40);return}
  if(e.__outOfPlayV057)return;e.__outOfPlayV057=true;
  const oldPhysics=e.physics.bind(e);
  function active(){const flow=window.FutLiveMatchFlow;return flow?.state?.phase===flow?.PHASES?.PLAYING&&!window.FutLiveApp?.isPaused?.()}
  function stopBall(){e.ball.owner=null;e.ball.vx=0;e.ball.vy=0;e.ball.curve=0;e.ball.intended=null;e.ball.pickupLock=performance.now()+250}
  function nearestTaker(team,x,y,allowGoalkeeper=false){let best=null,d=Infinity;for(const p of e.players){if(p.team!==team||(!allowGoalkeeper&&p.goalkeeper))continue;const n=Math.hypot(p.x-x,p.y-y);if(n<d){d=n;best=p}}return best}
  function freezePlayers(){for(const p of e.players)p.ctrl?.idle?.()}
  function resumeWith(taker,x,y,type){
    if(!taker){busy=false;window.FutLiveApp?.setPaused?.(false);return}
    const f=e.field(),attack=taker.team==='blue'?1:-1;
    taker.x=clamp(x-attack*10,f.left+14,f.right-14);
    taker.y=clamp(y-27,f.top+8,f.bottom-38);
    e.ball.x=x;e.ball.y=y;stopBall();e.paint?.();
    clearTimeout(restartTimer);
    restartTimer=setTimeout(()=>{
      if(window.FutLiveMatchFlow?.state?.phase!==window.FutLiveMatchFlow?.PHASES?.PLAYING){busy=false;return}
      e.takePossession(taker,type);
      e.syncOwnedBall?.();
      e.actionLock=performance.now()+220;
      e.paint?.();
      busy=false;
      window.FutLiveApp?.setPaused?.(false);
      window.dispatchEvent(new CustomEvent('futlive:restart',{detail:{type,team:taker.team}}));
    },RESTART_DELAY);
  }
  function restart(kind,team,x,y,side){
    if(busy)return;busy=true;
    const f=e.field();stopBall();freezePlayers();window.FutLiveApp?.setPaused?.(true);
    let rx=x,ry=y,taker=null;
    if(kind==='throw-in'){
      rx=clamp(x,f.left+24,f.right-24);ry=side==='top'?f.top+4:f.bottom-4;
      taker=nearestTaker(team,rx,ry,false);
      e.game.dataset.lastAction='throw-in';
    }else if(kind==='corner'){
      const left=side==='left';rx=left?f.left+5:f.right-5;ry=y<(f.top+f.bottom)/2?f.top+5:f.bottom-5;
      taker=nearestTaker(team,rx,ry,false);
      e.game.dataset.lastAction='corner';
    }else{
      const left=side==='left';rx=left?f.left+42:f.right-42;ry=(f.goalTop+f.goalBottom)/2;
      taker=e.goalkeepers?.find(g=>g.team===team)||nearestTaker(team,rx,ry,true);
      e.game.dataset.lastAction='goal-kick';
    }
    e.ball.x=rx;e.ball.y=ry;e.paint?.();
    window.dispatchEvent(new CustomEvent('futlive:outofplay',{detail:{kind,team,x:rx,y:ry}}));
    resumeWith(taker,rx,ry,kind);
  }
  function detect(dt,f){
    if(busy||!active())return false;
    const b=e.ball,last=e.ball.owner||e.ball.lastTouch,lastTeam=last?.team||null;
    const nx=b.owner?b.x:b.x+b.vx*dt,ny=b.owner?b.y:b.y+b.vy*dt;
    if(ny<f.top||ny>f.bottom||b.y<f.top||b.y>f.bottom){
      const team=lastTeam?other(lastTeam):(b.x<(f.left+f.right)/2?'red':'blue');
      restart('throw-in',team,clamp(b.x,f.left+24,f.right-24),ny<f.top||b.y<f.top?f.top:f.bottom,ny<f.top||b.y<f.top?'top':'bottom');
      return true;
    }
    const crossedLeft=nx<f.left||b.x<f.left,crossedRight=nx>f.right||b.x>f.right;
    if(!crossedLeft&&!crossedRight)return false;
    const cy=b.y+b.vy*dt;
    if(cy>=f.goalTop&&cy<=f.goalBottom)return false;
    const side=crossedLeft?'left':'right',defending=side==='left'?'blue':'red';
    if(lastTeam===defending)restart('corner',other(defending),side==='left'?f.left:f.right,clamp(cy,f.top,f.bottom),side);
    else restart('goal-kick',defending,side==='left'?f.left:f.right,clamp(cy,f.top,f.bottom),side);
    return true;
  }
  e.physics=(dt,f)=>{if(detect(dt,f))return;return oldPhysics(dt,f)};
  window.FutLiveOutOfPlay={isBusy:()=>busy};
}
boot();
})();