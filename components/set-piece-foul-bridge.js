(()=>{'use strict';
const VERSION='0.72';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
  const e=window.FutLiveFootballEngine,sp=window.FutLiveSetPieces;
  if(!e||!sp?.state){setTimeout(boot,45);return}if(e.__setPieceFoulBridgeV072)return;e.__setPieceFoulBridgeV072=true;
  const state=sp.state,oldBegin=sp.beginFreeKick?.bind(sp),oldTake=e.takePossession.bind(e),locks=new Map();let pendingFoul=null;
  const other=t=>t==='blue'?'red':'blue',attack=t=>t==='blue'?1:-1,pid=p=>p?.el?.id||null;
  const alive=p=>p&&!p.sentOff&&!p.tempSuspended,fielders=t=>e.players.filter(p=>alive(p)&&!p.goalkeeper&&(!t||p.team===t));
  const pause=()=>window.FutLiveApp?.setPaused?.(true),resume=()=>{window.FutLiveMatchFlow?.setPhase?.('PLAYING');window.FutLiveApp?.setPaused?.(false);window.FutLiveReferee?.releaseFollow?.()};
  const emit=(type,detail)=>window.dispatchEvent(new CustomEvent(type,{detail}));
  function bestTaker(team,spot){return fielders(team).slice().sort((a,b)=>{const da=Math.hypot(a.x-spot.x,a.y-spot.y),db=Math.hypot(b.x-spot.x,b.y-spot.y);return(-db*.06+b.skill.pass*17+b.skill.shoot*19+b.skill.composure*10)-(-da*.06+a.skill.pass*17+a.skill.shoot*19+a.skill.composure*10)})[0]||null}
  function space(p,team){const os=fielders(other(team));return os.length?Math.min(...os.map(o=>e.dist(p,o))):160}
  function pickPartner(team,taker,spot){const a=attack(team);return fielders(team).filter(p=>p!==taker).slice().sort((x,y)=>{const sx=(x.x-spot.x)*a*.30+space(x,team)*.72-e.dist(x,spot)*.05+(x.skill.pass||.6)*10,sy=(y.x-spot.x)*a*.30+space(y,team)*.72-e.dist(y,spot)*.05+(y.skill.pass||.6)*10;return sy-sx})[0]||null}
  function chooseDecision(team,taker,spot,f){const a=attack(team),goalX=team==='blue'?f.right:f.left,distGoal=Math.abs(goalX-spot.x),partner=pickPartner(team,taker,spot);if(distGoal<f.w*.32&&(taker.skill.shoot||.5)>.54)return{mode:'SHOT',partner};if(partner&&space(partner,team)>38&&((partner.x-spot.x)*a)>20)return{mode:'PASS',partner};if(partner&&space(partner,team)>28)return{mode:'SHORT',partner};return{mode:'LONG_ADVANCE',partner:null}}
  function stop(p){p.aiVelocity={x:0,y:0};p.ctrl?.cancelPendingDirection?.();p.ctrl?.idle?.()}
  function position(map,spot,onReady){const started=performance.now();let last=started,stable=0;function frame(t){if(!state.busy||state.type!=='DIRECT_FREE_KICK')return;const dt=Math.min(.04,(t-last)/1000||.016);last=t;let max=0;for(const [p,q] of map){const d=Math.hypot(q.x-p.x,q.y-p.y);max=Math.max(max,d);if(d>2)e.moveToward(p,q.x,q.y,p.speed*(p.goalkeeper?.82:.92),dt);else stop(p)}e.ball.owner=null;e.ball.type='set-piece-dead';e.ball.x=spot.x;e.ball.y=spot.y;e.ball.vx=e.ball.vy=0;e.ball.z=0;e.ball.vz=0;e.paint?.();stable=max<7?stable+1:0;if(stable>5||t-started>4300){for(const [p] of map)stop(p);setTimeout(onReady,320);return}requestAnimationFrame(frame)}requestAnimationFrame(frame)}
  function lockSecondTouch(taker){locks.set(taker,performance.now());taker.freeKickSecondTouchLock=true;emit('futlive:free-kick-second-touch-lock',{taker:pid(taker)})}
  function clearLock(taker,by=null){if(!taker)return;locks.delete(taker);delete taker.freeKickSecondTouchLock;emit('futlive:free-kick-second-touch-cleared',{taker:pid(taker),by:pid(by)})}
  function strike(taker,target,{type,speed,intended=null,curve=0}){const s=e.foot(taker),dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1;e.ball.owner=null;e.ball.type=type;e.ball.lastTouch=taker;e.ball.intended=intended;e.ball.x=s.x;e.ball.y=s.y;e.ball.z=0;e.ball.vz=0;e.ball.vx=dx/d*speed;e.ball.vy=dy/d*speed;e.ball.curve=curve;e.ball.pickupLock=performance.now()+220;taker.ctrl?.kick?.();lockSecondTouch(taker);if(e.game){e.game.dataset.lastSetPiece='DIRECT_FREE_KICK';e.game.dataset.lastAction=type}}
  function finish(){setTimeout(()=>{if(state.type!=='DIRECT_FREE_KICK')return;state.busy=false;state.stage=null;state.lastRestartAt=performance.now();resume();emit('futlive:restart',{type:'DIRECT_FREE_KICK',team:state.team})},430)}
  function beginSmartFreeKick(detail){
    if(state.busy||!detail?.victim)return false;const f=e.field(),team=detail.victim.team,a=attack(team),spot={x:clamp(detail.x,f.left+24,f.right-24),y:clamp(detail.y,f.top+24,f.bottom-34)},goalX=team==='blue'?f.right:f.left,goalY=(f.goalTop+f.goalBottom)/2;
    const inPenalty=Math.abs(spot.x-goalX)<f.w*.17&&spot.y>f.goalTop-74&&spot.y<f.goalBottom+74;if(inPenalty&&oldBegin)return oldBegin(detail);
    const taker=bestTaker(team,spot);if(!taker)return false;const decision=chooseDecision(team,taker,spot,f),partner=decision.partner;
    state.busy=true;state.type='DIRECT_FREE_KICK';state.team=team;state.taker=taker;state.spot=spot;state.stage='POSITIONING';pause();window.FutLiveMatchFlow?.setPhase?.('SET_PIECE');
    const map=new Map();map.set(taker,{x:spot.x-a*20,y:spot.y-27});const mates=fielders(team).filter(p=>p!==taker),defs=fielders(other(team));
    mates.forEach((p,i)=>{let x=clamp(spot.x+a*(82+i*18),f.left+34,f.right-34),y=clamp(spot.y+(i%2?58:-58),f.top+34,f.bottom-44);if(decision.mode==='SHORT'&&p===partner){x=clamp(spot.x+a*46,f.left+34,f.right-34);y=clamp(spot.y+(spot.y<goalY?38:-38),f.top+34,f.bottom-44)}map.set(p,{x,y})});
    defs.slice().sort((x,y)=>e.dist(x,spot)-e.dist(y,spot)).forEach((p,i)=>map.set(p,i<3?{x:spot.x+a*58,y:clamp(spot.y+(i-1)*24-27,f.top+30,f.bottom-42)}:{x:clamp(f.w*(p.home?.[0]??.5),f.left+30,f.right-30),y:clamp(f.h*(p.home?.[1]??.5),f.top+30,f.bottom-42)}));
    for(const g of e.goalkeepers)map.set(g,{x:g.team==='blue'?f.left+42:f.right-42,y:goalY-27});
    position(map,spot,()=>{if(!state.busy||state.type!=='DIRECT_FREE_KICK')return;state.stage='DECIDE_'+decision.mode;
      if(decision.mode==='SHOT'){const y=clamp(goalY+(Math.random()-.5)*54,f.goalTop+8,f.goalBottom-8),curve=(Math.random()<.5?-1:1)*(.10+(taker.skill.curve||.5)*.18);strike(taker,{x:goalX+a*f.goalDepth,y},{type:'free-kick-shot',speed:285+(taker.skill.shoot||.6)*76,curve})}
      else if((decision.mode==='PASS'||decision.mode==='SHORT')&&partner){strike(taker,{x:partner.x+a*10,y:partner.y+27},{type:decision.mode==='SHORT'?'free-kick-short-pass':'free-kick-pass',speed:decision.mode==='SHORT'?165:205,intended:partner})}
      else{const advanceX=clamp(spot.x+a*Math.min(f.w*.34,190),f.left+45,f.right-45),advanceY=clamp(goalY+(Math.random()-.5)*f.h*.30,f.top+42,f.bottom-50);strike(taker,{x:advanceX,y:advanceY},{type:'free-kick-long-advance',speed:245+(taker.skill.pass||.6)*42})}
      emit('futlive:free-kick-decision',{team,taker:pid(taker),mode:decision.mode,target:pid(partner),spot});finish()
    });return true
  }
  sp.beginFreeKick=beginSmartFreeKick;
  window.addEventListener('futlive:foul',ev=>{pendingFoul=ev.detail||null});
  e.takePossession=(p,reason='control')=>{
    if(p&&locks.has(p)&&e.ball.lastTouch===p){emit('futlive:free-kick-second-touch-blocked',{taker:pid(p),reason});return false}
    const result=oldTake(p,reason);if(p&&e.ball.owner===p){for(const taker of [...locks.keys()])if(taker!==p)clearLock(taker,p)}
    if(reason==='foul-restart'&&p){const detail=pendingFoul||{victim:p,x:e.ball.x,y:e.ball.y};pendingFoul=null;setTimeout(()=>{if(!sp.state.busy)sp.beginFreeKick(detail)},640)}return result
  };
  window.FutLiveSetPieceFoulBridge={version:VERSION,locks,beginSmartFreeKick,debug:()=>({locks:[...locks.keys()].map(pid),state:{type:state.type,stage:state.stage,team:state.team,taker:pid(state.taker)}})};
}
boot();
})();