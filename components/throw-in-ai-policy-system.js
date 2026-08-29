(()=>{'use strict';
const VERSION='0.71.0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
  const e=window.FutLiveFootballEngine,br=window.FutLiveBoundaryRestarts;
  if(!e||!br?.state||!e.players?.length){setTimeout(boot,45);return}
  if(e.__throwInAIPolicyV071)return;e.__throwInAIPolicyV071=true;
  const other=t=>t==='blue'?'red':'blue',attack=t=>t==='blue'?1:-1,pid=p=>p?.el?.id||null;
  const alive=p=>p&&!p.sentOff&&!p.tempSuspended;
  const mates=t=>e.players.filter(p=>alive(p)&&!p.goalkeeper&&p.team===t);
  const opps=t=>e.players.filter(p=>alive(p)&&!p.goalkeeper&&p.team===other(t));
  function lineHitsGoal(sx,sy,vx,vy,goalX,top,bottom){if(Math.abs(vx)<1)return false;const t=(goalX-sx)/vx;if(t<=0)return false;const y=sy+vy*t;return y>=top-8&&y<=bottom+8}
  function goalAimRisk(team,spot,target){
    const f=e.field(),gx=team==='blue'?f.right:f.left,gy=(f.goalTop+f.goalBottom)/2;
    const tx=target.x,ty=target.y+27,dx=tx-spot.x,dy=ty-spot.y,d=Math.hypot(dx,dy)||1;
    const goalDx=gx-spot.x,goalDy=gy-spot.y,gd=Math.hypot(goalDx,goalDy)||1;
    const dot=clamp((dx*goalDx+dy*goalDy)/(d*gd),-1,1),angle=Math.acos(dot)*180/Math.PI;
    const towardGoal=dx*attack(team)>0,attackingThird=Math.abs(gx-spot.x)<f.w*.44;
    const direct=lineHitsGoal(spot.x,spot.y,dx/d*180,dy/d*180,gx,f.goalTop,f.goalBottom);
    return{unsafe:direct||(towardGoal&&attackingThird&&angle<17),direct,angle}
  }
  function unsafeDirectGoal(team){const f=e.field(),b=e.ball,gx=team==='blue'?f.right:f.left;return lineHitsGoal(b.x,b.y,b.vx,b.vy,gx,f.goalTop,f.goalBottom)}
  function scoreTarget(p,team,spot){
    const f=e.field(),a=attack(team),os=opps(team),space=os.length?Math.min(...os.map(o=>e.dist(p,o))):120;
    const dx=p.x-spot.x,dy=(p.y+27)-spot.y,dist=Math.hypot(dx,dy),forward=dx*a;
    const goalX=team==='blue'?f.right:f.left,nearGoal=Math.abs(goalX-p.x)<f.w*.18,centralGoalLane=(p.y+27)>=f.goalTop-28&&(p.y+27)<=f.goalBottom+28;
    const risk=goalAimRisk(team,spot,p);
    let score=space*.76-dist*.052+Math.max(-20,Math.min(80,forward))*.09+(p.skill?.pass||.6)*10;
    if(dist<36)score-=20;if(dist>f.w*.36)score-=32;if(nearGoal&&centralGoalLane)score-=190;
    if(risk.direct)score-=260;else if(risk.unsafe)score-=150;
    // Preferência deliberada por lateral/apoio, não por mirar a boca do gol.
    const gy=(f.goalTop+f.goalBottom)/2;if(Math.abs((p.y+27)-gy)>48)score+=12;
    return score
  }
  function safeTarget(team,taker,spot){
    const list=mates(team).filter(p=>p!==taker).sort((a,b)=>scoreTarget(b,team,spot)-scoreTarget(a,team,spot));
    return list.find(p=>!goalAimRisk(team,spot,p).unsafe)||list.find(p=>!goalAimRisk(team,spot,p).direct)||list[0]||null
  }
  function redirect(team,taker){
    const b=e.ball,f=e.field(),spot={x:b.x,y:b.y},target=safeTarget(team,taker,spot);if(!target)return false;
    const tx=clamp(target.x,f.left+28,f.right-28),ty=clamp(target.y+27,f.top+30,f.bottom-30),dx=tx-spot.x,dy=ty-spot.y,d=Math.hypot(dx,dy)||1,oldSpeed=Math.max(150,Math.min(200,Math.hypot(b.vx,b.vy)||176));
    b.vx=dx/d*oldSpeed;b.vy=dy/d*oldSpeed;b.intended=target;b.type='throw-in-hand-air';
    if(e.game){e.game.dataset.throwInGoalGuard='redirected';e.game.dataset.throwInSafeTarget=pid(target)||'';e.game.dataset.throwInRuleKnowledge='DIRECT_GOAL_INVALID'}
    window.dispatchEvent(new CustomEvent('futlive:throwin-goal-guard',{detail:{team,taker:pid(taker),target:pid(target),reason:'direct-goal-invalid'}}));return true
  }
  window.addEventListener('futlive:throwin-release',ev=>{
    const d=ev.detail||{},team=d.team,taker=e.players.find(p=>pid(p)===d.taker)||br.state.taker;if(!team||!taker)return;
    if(e.game)e.game.dataset.throwInRuleKnowledge='DIRECT_GOAL_INVALID';
    const intended=e.ball.intended,risk=intended?goalAimRisk(team,{x:e.ball.x,y:e.ball.y},intended):null;
    if(unsafeDirectGoal(team)||risk?.unsafe)redirect(team,taker)
  });
  window.FutLiveThrowInAIPolicy={version:VERSION,rule:'DIRECT_THROW_IN_GOAL_INVALID',unsafeDirectGoal,goalAimRisk,safeTarget,scoreTarget,redirect,debug:()=>({rule:'DIRECT_THROW_IN_GOAL_INVALID',lastGuard:e.game?.dataset?.throwInGoalGuard||null,safeTarget:e.game?.dataset?.throwInSafeTarget||null})};
}
boot();
})();