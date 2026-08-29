(()=>{'use strict';
const VERSION='0.64.0';
const other=t=>t==='blue'?'red':'blue';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
  const e=window.FutLiveFootballEngine,game=document.getElementById('game');
  if(!e||!e.players?.length||!game||typeof e.takePossession!=='function'||typeof e.physics!=='function'){setTimeout(boot,50);return}
  if(e.__throwInRulesV064)return;e.__throwInRulesV064=true;
  const oldTake=e.takePossession.bind(e),oldPhysics=e.physics.bind(e);
  const state={active:false,taker:null,team:null,target:null,releasedAt:0,otherTouch:false,violating:false,directGoalHandled:false};
  const pid=p=>p?.el?.id||null;
  const living=p=>p&&!p.sentOff&&!p.tempSuspended;
  const fielders=t=>e.players.filter(p=>living(p)&&!p.goalkeeper&&(!t||p.team===t));
  const emit=(type,detail)=>window.dispatchEvent(new CustomEvent(type,{detail}));
  function clear(reason='other-touch'){
    if(state.taker){delete state.taker.restartSecondTouchLock;delete state.taker.restartReceiveLockUntil}
    const prev={taker:pid(state.taker),team:state.team,reason};
    state.active=false;state.taker=null;state.team=null;state.target=null;state.releasedAt=0;state.otherTouch=false;state.directGoalHandled=false;
    emit('futlive:throwin-second-touch-cleared',prev)
  }
  function beginIndirect(offender,x,y){
    if(state.violating)return;state.violating=true;
    const f=e.field(),team=other(offender.team),spot={x:clamp(x,f.left+24,f.right-24),y:clamp(y,f.top+24,f.bottom-34)};
    const sp=window.FutLiveSetPieces?.state;
    window.FutLiveApp?.setPaused?.(true);window.FutLiveMatchFlow?.setPhase?.('SET_PIECE');
    if(sp){sp.busy=true;sp.exclusive=true;sp.type='INDIRECT_FREE_KICK';sp.team=team;sp.spot=spot;sp.stage='SECOND_TOUCH';}
    e.ball.owner=null;e.ball.x=spot.x;e.ball.y=spot.y;e.ball.vx=e.ball.vy=0;e.ball.curve=0;e.ball.z=0;e.ball.vz=0;e.ball.type='indirect-free-kick-dead';e.ball.intended=null;e.ball.pickupLock=performance.now()+700;e.paint?.();
    const taker=fielders(team).slice().sort((a,b)=>Math.hypot(a.x-spot.x,a.y-spot.y)-Math.hypot(b.x-spot.x,b.y-spot.y))[0]||null;
    const mates=fielders(team).filter(p=>p!==taker);const target=mates.slice().sort((a,b)=>Math.abs(e.dist(a,taker||spot)-75)-Math.abs(e.dist(b,taker||spot)-75))[0]||mates[0]||null;
    emit('futlive:throwin-double-touch',{offender:pid(offender),offenderTeam:offender.team,team,x:spot.x,y:spot.y,restart:'INDIRECT_FREE_KICK'});
    setTimeout(()=>{
      if(!taker||!target){if(sp){sp.busy=false;sp.exclusive=false;sp.stage=null}window.FutLiveMatchFlow?.setPhase?.('PLAYING');window.FutLiveApp?.setPaused?.(false);state.violating=false;return}
      const a=team==='blue'?1:-1;taker.x=clamp(spot.x-a*18,f.left+20,f.right-20);taker.y=clamp(spot.y-27,f.top+18,f.bottom-40);taker.facing=a>0?'right':'left';taker.lastDir=taker.facing;
      const s=e.foot(taker),tx=target.x,ty=target.y+27,dx=tx-s.x,dy=ty-s.y,d=Math.hypot(dx,dy)||1,speed=175;
      e.ball.owner=null;e.ball.type='indirect-free-kick-pass';e.ball.lastTouch=taker;e.ball.intended=target;e.ball.x=s.x;e.ball.y=s.y;e.ball.z=0;e.ball.vz=0;e.ball.vx=dx/d*speed;e.ball.vy=dy/d*speed;e.ball.curve=0;e.ball.pickupLock=performance.now()+160;taker.ctrl?.kick?.();game.dataset.lastSetPiece='INDIRECT_FREE_KICK';game.dataset.lastAction='indirect-free-kick-pass';e.paint?.();
      setTimeout(()=>{if(sp){sp.busy=false;sp.exclusive=false;sp.stage=null;sp.lastRestartAt=performance.now()}window.FutLiveMatchFlow?.setPhase?.('PLAYING');window.FutLiveApp?.setPaused?.(false);state.violating=false;emit('futlive:restart',{type:'INDIRECT_FREE_KICK',team,spot})},300)
    },720)
  }
  window.addEventListener('futlive:throwin-release',ev=>{
    const d=ev.detail||{},taker=e.players.find(p=>pid(p)===d.taker);if(!taker)return;
    if(state.active)clear('new-throw');state.active=true;state.taker=taker;state.team=taker.team;state.target=d.target||null;state.releasedAt=performance.now();state.otherTouch=false;state.directGoalHandled=false;
    taker.restartSecondTouchLock=true;taker.restartReceiveLockUntil=Number.POSITIVE_INFINITY;
    emit('futlive:throwin-second-touch-lock',{taker:pid(taker),team:taker.team,target:d.target||null})
  });
  e.takePossession=(p,reason='control')=>{
    if(state.active&&p){
      if(p===state.taker&&!state.otherTouch){const x=e.ball.x,y=e.ball.y;clear('double-touch');beginIndirect(p,x,y);return false}
      if(p!==state.taker){state.otherTouch=true;clear('other-player-possession')}
    }
    return oldTake(p,reason)
  };
  function directGoalRestart(side,f){
    if(!state.active||state.directGoalHandled)return false;state.directGoalHandled=true;
    const throwTeam=state.team,opponent=other(throwTeam),opponentGoal=(throwTeam==='blue'&&side==='right')||(throwTeam==='red'&&side==='left');
    const kind=opponentGoal?'goal-kick':'corner',team=opponent,y=clamp(e.ball.y,f.goalTop,f.goalBottom),x=side==='left'?f.left:f.right;
    clear(opponentGoal?'direct-opponent-goal':'direct-own-goal');
    e.ball.owner=null;e.ball.vx=e.ball.vy=0;e.ball.curve=0;e.ball.intended=null;e.ball.x=x;e.ball.y=y;e.ball.type='set-piece-dead';
    window.FutLiveApp?.setPaused?.(true);
    const handled=window.FutLiveBoundaryRestarts?.handle?.({kind,team,x,y,side})===true;
    emit('futlive:throwin-direct-goal',{throwTeam,side,result:kind,team,handled});
    if(!handled){window.FutLiveMatchFlow?.setPhase?.('SET_PIECE')}
    return true
  }
  e.physics=(dt,f)=>{
    if(state.active&&!state.otherTouch&&!e.ball.owner){
      const b=e.ball,nx=b.x+(b.vx||0)*dt,ny=b.y+(b.vy||0)*dt,inGoalY=ny>=f.goalTop&&ny<=f.goalBottom;
      if(inGoalY&&(nx<f.left||b.x<f.left))return directGoalRestart('left',f);
      if(inGoalY&&(nx>f.right||b.x>f.right))return directGoalRestart('right',f)
    }
    const r=oldPhysics(dt,f);
    if(state.active&&e.ball.lastTouch&&e.ball.lastTouch!==state.taker){state.otherTouch=true;clear('other-player-touch')}
    return r
  };
  window.FutLiveThrowInRules={version:VERSION,state,clear};
}
boot();
})();