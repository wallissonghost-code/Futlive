(()=>{'use strict';
const VERSION='0.68.0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
  const e=window.FutLiveFootballEngine,br=window.FutLiveBoundaryRestarts;
  if(!e||!br?.state||!e.players?.length){setTimeout(boot,45);return}
  if(e.__throwInAIPolicyV068)return;e.__throwInAIPolicyV068=true;
  const other=t=>t==='blue'?'red':'blue',attack=t=>t==='blue'?1:-1,pid=p=>p?.el?.id||null;
  const alive=p=>p&&!p.sentOff&&!p.tempSuspended;
  const mates=t=>e.players.filter(p=>alive(p)&&!p.goalkeeper&&p.team===t);
  const opps=t=>e.players.filter(p=>alive(p)&&!p.goalkeeper&&p.team===other(t));
  function lineHitsGoal(sx,sy,vx,vy,goalX,top,bottom){
    if(Math.abs(vx)<1)return false;const t=(goalX-sx)/vx;if(t<=0)return false;const y=sy+vy*t;return y>=top-5&&y<=bottom+5
  }
  function unsafeDirectGoal(team){
    const f=e.field(),b=e.ball,gx=team==='blue'?f.right:f.left;
    return lineHitsGoal(b.x,b.y,b.vx,b.vy,gx,f.goalTop,f.goalBottom)
  }
  function scoreTarget(p,team,spot){
    const f=e.field(),a=attack(team),os=opps(team),space=os.length?Math.min(...os.map(o=>e.dist(p,o))):120;
    const dx=p.x-spot.x,dy=(p.y+27)-spot.y,dist=Math.hypot(dx,dy),forward=dx*a;
    const goalX=team==='blue'?f.right:f.left,nearGoal=Math.abs(goalX-p.x)<f.w*.16;
    const centralGoalLane=(p.y+27)>=f.goalTop-20&&(p.y+27)<=f.goalBottom+20;
    let score=space*.72-dist*.055+Math.max(-20,Math.min(80,forward))*.10+(p.skill?.pass||.6)*10;
    if(dist<34)score-=22;if(dist>f.w*.38)score-=28;
    // Nunca incentivar receptor colado/na linha da boca do gol em lateral.
    if(nearGoal&&centralGoalLane)score-=180;
    return score
  }
  function safeTarget(team,taker,spot){
    const list=mates(team).filter(p=>p!==taker).sort((a,b)=>scoreTarget(b,team,spot)-scoreTarget(a,team,spot));
    const f=e.field(),gx=team==='blue'?f.right:f.left;
    return list.find(p=>{
      const dx=p.x-spot.x,dy=(p.y+27)-spot.y,d=Math.hypot(dx,dy)||1,vx=dx/d*180,vy=dy/d*180;
      return !lineHitsGoal(spot.x,spot.y,vx,vy,gx,f.goalTop,f.goalBottom)
    })||list[0]||null
  }
  function redirect(team,taker){
    const b=e.ball,f=e.field(),spot={x:b.x,y:b.y},target=safeTarget(team,taker,spot);if(!target)return false;
    const tx=clamp(target.x,f.left+28,f.right-28),ty=clamp(target.y+27,f.top+30,f.bottom-30),dx=tx-spot.x,dy=ty-spot.y,d=Math.hypot(dx,dy)||1;
    const oldSpeed=Math.max(150,Math.min(200,Math.hypot(b.vx,b.vy)||176));
    b.vx=dx/d*oldSpeed;b.vy=dy/d*oldSpeed;b.intended=target;b.type='throw-in-hand-air';
    if(e.game){e.game.dataset.throwInGoalGuard='redirected';e.game.dataset.throwInSafeTarget=pid(target)||''}
    window.dispatchEvent(new CustomEvent('futlive:throwin-goal-guard',{detail:{team,taker:pid(taker),target:pid(target),reason:'direct-goal-trajectory'}}));
    return true
  }
  window.addEventListener('futlive:throwin-release',ev=>{
    const d=ev.detail||{},team=d.team,taker=e.players.find(p=>pid(p)===d.taker)||br.state.taker;if(!team||!taker)return;
    if(unsafeDirectGoal(team))redirect(team,taker);
  });
  window.FutLiveThrowInAIPolicy={version:VERSION,unsafeDirectGoal,safeTarget,redirect,debug:()=>({lastGuard:e.game?.dataset?.throwInGoalGuard||null,safeTarget:e.game?.dataset?.throwInSafeTarget||null})};
}
boot();
})();