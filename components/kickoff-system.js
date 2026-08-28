(()=>{'use strict';
const PHASES={SETUP:'KICKOFF_SETUP',READY:'KICKOFF_READY',KICKOFF:'KICKOFF'};
function boot(){
  const e=window.FutLiveFootballEngine,game=document.getElementById('game'),pauseBtn=document.getElementById('pauseBtn');
  if(!e||!game||!pauseBtn||!e.players?.length){setTimeout(boot,45);return}if(window.FutLiveKickoffSystem)return;
  const state={team:null,busy:false,initialDone:false,PHASES};
  const living=(team)=>e.players.filter(p=>p.team===team&&!p.sentOff);
  const lines=(team)=>living(team).filter(p=>!p.goalkeeper);
  function setPhase(p){window.FutLiveMatchFlow?.setPhase(p)}
  function center(){const f=e.field();return{x:(f.left+f.right)/2,y:(f.top+f.bottom)/2,f}}
  function targets(team){const {x:cx,y:cy,f}=center(),other=team==='blue'?'red':'blue',map=new Map(),ownBlue=p=>p.team==='blue';
    const recv=lines(team),opp=lines(other),taker=recv[0],mate=recv[1]||recv[0];
    for(const p of e.players){if(p.sentOff)continue;if(p.goalkeeper){map.set(p,{x:p.team==='blue'?f.left+46:f.right-46,y:(f.goalTop+f.goalBottom)/2-27});continue}
      if(p===taker)map.set(p,{x:cx+(team==='blue'?-10:10),y:cy-27});
      else if(p===mate)map.set(p,{x:cx+(team==='blue'?-42:42),y:cy-9});
      else{let x=f.w*p.home[0],y=f.h*p.home[1];const blue=ownBlue(p);x=blue?Math.min(x,cx-34):Math.max(x,cx+34);if(p.team===other){const d=Math.hypot(x-cx,y+27-cy);if(d<78)x=blue?cx-82:cx+82}map.set(p,{x,y})}
    }return{map,taker,mate,cx,cy,f}}
  function begin(team,{initial=false,onStarted=null}={}){if(state.busy)return false;state.busy=true;state.team=team;setPhase(PHASES.SETUP);if(!game.classList.contains('is-paused'))pauseBtn.click();
    const setup=targets(team),start=performance.now();e.ball.owner=null;e.ball.type='free';e.ball.x=setup.cx;e.ball.y=setup.cy;e.ball.vx=e.ball.vy=0;e.ball.curve=0;window.FutLiveReferee?.moveNearCenter();
    let last=performance.now(),stable=0;function frame(t){if(window.FutLiveMatchState?.phase!==PHASES.SETUP)return;const dt=Math.min(.04,(t-last)/1000||.016);last=t;let max=0;
      for(const [p,q] of setup.map){const d=Math.hypot(q.x-p.x,q.y-p.y);max=Math.max(max,d);e.moveToward(p,q.x,q.y,p.goalkeeper?p.speed*.82:p.speed*.90,dt)}e.ball.x=setup.cx;e.ball.y=setup.cy;e.ball.vx=e.ball.vy=0;e.paint();
      stable=max<6?stable+1:0;if(stable>5||performance.now()-start>4200){ready(setup,onStarted,max);return}requestAnimationFrame(frame)}requestAnimationFrame(frame);return true}
  function ready(setup,onStarted,maxRemaining=0){setPhase(PHASES.READY);for(const [p] of setup.map){p.aiVelocity={x:0,y:0};p.ctrl.idle();p.lastDir='idle'}e.ball.owner=null;e.ball.x=setup.cx;e.ball.y=setup.cy;e.ball.vx=e.ball.vy=0;e.ball.type='free';e.paint();state.lastSetupResidual=maxRemaining;setTimeout(()=>kick(setup,onStarted),420)}
  function kick(setup,onStarted){const {taker,mate}=setup;if(!taker||!mate){setPhase('PLAYING');if(game.classList.contains('is-paused'))pauseBtn.click();state.busy=false;return}
    setPhase(PHASES.KICKOFF);taker.facing=taker.team==='blue'?'left':'right';const start=e.foot(taker),target=e.foot(mate),dx=target.x-start.x,dy=target.y-start.y,m=Math.hypot(dx,dy)||1;e.ball.owner=null;e.ball.type='pass';e.ball.lastTouch=taker;e.ball.intended=mate;e.ball.x=start.x;e.ball.y=start.y;e.ball.vx=dx/m*128;e.ball.vy=dy/m*128;e.ball.pickupLock=performance.now()+90;taker.ctrl.kick();
    if(game.classList.contains('is-paused'))pauseBtn.click();window.FutLiveGroundGame?.protect(taker,350);window.FutLiveGroundGame?.protect(mate,430);setTimeout(()=>{setPhase('PLAYING');window.FutLiveGroundGame?.protect(mate,360);window.FutLiveReferee?.releaseFollow();state.busy=false;state.initialDone=true;if(typeof onStarted==='function')onStarted()},260)}
  state.beginInitial=()=>begin(Math.random()<.5?'blue':'red',{initial:true});state.beginAfterGoal=(scoringTeam,onStarted)=>begin(scoringTeam==='blue'?'red':'blue',{onStarted});state.beginForTeam=(team,onStarted)=>begin(team,{onStarted});window.FutLiveKickoffSystem=state;
}
boot();
})();