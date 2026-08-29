(()=>{'use strict';
const VERSION='0.73.0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const other=t=>t==='blue'?'red':'blue';
function boot(){
  const e=window.FutLiveFootballEngine,game=document.getElementById('game');
  if(!e||!game||!e.players?.length){setTimeout(boot,45);return}
  if(window.FutLiveSetPieces)return;
  const state={busy:false,exclusive:false,type:null,team:null,taker:null,spot:null,lastRestartAt:0,version:VERSION,stage:null};
  const living=t=>e.players.filter(p=>!p.sentOff&&!p.tempSuspended&&(!t||p.team===t));
  const fielders=t=>living(t).filter(p=>!p.goalkeeper);
  const goalkeeper=t=>living(t).find(p=>p.goalkeeper)||null;
  const attack=t=>t==='blue'?1:-1;
  const setPhase=p=>window.FutLiveMatchFlow?.setPhase?.(p);
  const pause=()=>window.FutLiveApp?.setPaused?.(true);
  const resume=()=>{setPhase('PLAYING');window.FutLiveApp?.setPaused?.(false);window.FutLiveReferee?.releaseFollow?.()};
  const emit=(type,detail)=>window.dispatchEvent(new CustomEvent(type,{detail}));
  const pid=p=>p?.el?.id||null;
  function bestTaker(team,type,spot){
    return fielders(team).slice().sort((a,b)=>{
      const da=Math.hypot(a.x-spot.x,a.y-spot.y),db=Math.hypot(b.x-spot.x,b.y-spot.y);
      let sa=-da*.075+(a.skill?.pass||.6)*18+(a.skill?.composure||.6)*8;
      let sb=-db*.075+(b.skill?.pass||.6)*18+(b.skill?.composure||.6)*8;
      if(type==='PENALTY'||type==='DIRECT_FREE_KICK'){sa+=(a.skill?.shoot||.6)*22;sb+=(b.skill?.shoot||.6)*22}
      return sb-sa
    })[0]||null
  }
  function stop(p){p.aiVelocity={x:0,y:0};p.lastDir='idle';p.ctrl?.idle?.()}
  function position(map,spot,onReady,timeout=4200){
    const started=performance.now();let last=started,stable=0;
    function frame(t){
      if(!state.busy)return;
      const dt=Math.min(.04,(t-last)/1000||.016);last=t;let max=0;
      for(const [p,q] of map){const d=Math.hypot(q.x-p.x,q.y-p.y);max=Math.max(max,d);if(d>1.5)e.moveToward(p,q.x,q.y,p.goalkeeper?p.speed*.86:p.speed*.92,dt);else stop(p)}
      e.ball.owner=null;e.ball.x=spot.x;e.ball.y=spot.y;e.ball.vx=e.ball.vy=0;e.ball.curve=0;e.ball.intended=null;e.ball.type='set-piece-dead';e.paint?.();
      stable=max<7?stable+1:0;
      if(stable>5||t-started>timeout){for(const [p] of map)stop(p);state.stage=t-started>timeout?'READY_TIMEOUT':'READY';setTimeout(onReady,260);return}
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }
  function strike(taker,target,{speed=220,type='set-piece',curve=0,intended=null}={}){
    const s=e.foot(taker),dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1;
    e.ball.owner=null;e.ball.type=type;e.ball.lastTouch=taker;e.ball.intended=intended;e.ball.x=s.x;e.ball.y=s.y;e.ball.vx=dx/d*speed;e.ball.vy=dy/d*speed;e.ball.curve=curve;e.ball.pickupLock=performance.now()+180;
    taker.ctrl?.kick?.();game.dataset.lastSetPiece=state.type;game.dataset.lastAction=type
  }
  function finish(delay=320){setTimeout(()=>{state.busy=false;state.exclusive=false;state.stage=null;state.lastRestartAt=performance.now();resume();emit('futlive:restart',{type:state.type,team:state.team})},delay)}
  function penaltyArea(team,f,x,y){const gx=team==='blue'?f.right:f.left;return Math.abs(x-gx)<f.w*.17&&y>f.goalTop-74&&y<f.goalBottom+74}
  function chooseFreeKickAction(team,taker,spot,mates,f){
    const a=attack(team),goalX=team==='blue'?f.right:f.left,goalY=(f.goalTop+f.goalBottom)/2,distGoal=Math.abs(goalX-spot.x);
    const opponents=fielders(other(team));
    const open=p=>opponents.length?Math.min(...opponents.map(o=>e.dist(p,o))):120;
    const forward=mates.filter(p=>(p.x-spot.x)*a>18).sort((x,y)=>(open(y)+(y.x-spot.x)*a*.18)-(open(x)+(x.x-spot.x)*a*.18));
    if(distGoal<f.w*.33&&(taker.skill?.shoot||.6)>.64)return{kind:'SHOT',target:{x:goalX+a*f.goalDepth,y:goalY+(Math.random()-.5)*42}};
    const short=mates.filter(p=>e.dist(p,taker)<95).sort((x,y)=>open(y)-open(x))[0];
    if(short&&open(short)>38)return{kind:'SHORT_PASS',player:short,target:{x:short.x+a*12,y:short.y+27}};
    const partner=forward[0];if(partner)return{kind:'PASS',player:partner,target:{x:partner.x+a*22,y:partner.y+27}};
    const long=mates.slice().sort((x,y)=>((y.x-x.x)*a+open(y)*.5)-((x.x-spot.x)*a+open(x)*.5))[0];
    if(long)return{kind:'LONG',player:long,target:{x:clamp(long.x+a*42,f.left+28,f.right-28),y:long.y+27}};
    return{kind:'CLEAR',target:{x:clamp(spot.x+a*f.w*.30,f.left+28,f.right-28),y:goalY}}
  }
  function beginFreeKick(detail){
    if(state.busy||!detail?.victim)return false;
    const f=e.field(),team=detail.victim.team,a=attack(team),spot={x:clamp(detail.x,f.left+24,f.right-24),y:clamp(detail.y,f.top+24,f.bottom-34)};
    if(penaltyArea(team,f,spot.x,spot.y))return beginPenalty(team);
    const taker=bestTaker(team,'DIRECT_FREE_KICK',spot);if(!taker)return false;
    state.busy=true;state.exclusive=true;state.type='DIRECT_FREE_KICK';state.team=team;state.taker=taker;state.spot=spot;state.stage='POSITIONING';pause();setPhase('SET_PIECE');
    const mates=fielders(team).filter(p=>p!==taker),defs=fielders(other(team)),map=new Map(),goalY=(f.goalTop+f.goalBottom)/2;
    map.set(taker,{x:spot.x-a*18,y:spot.y-27});
    mates.forEach((p,i)=>map.set(p,{x:clamp(spot.x+a*(55+i*20),f.left+34,f.right-34),y:clamp(spot.y+(i%2?50:-50),f.top+34,f.bottom-44)}));
    defs.forEach((p,i)=>map.set(p,i<3?{x:spot.x+a*58,y:clamp(spot.y+(i-1)*24-27,f.top+30,f.bottom-42)}:{x:clamp(f.w*p.home[0],f.left+30,f.right-30),y:clamp(f.h*p.home[1],f.top+30,f.bottom-42)}));
    for(const g of e.goalkeepers)map.set(g,{x:g.team==='blue'?f.left+42:f.right-42,y:goalY-27});
    position(map,spot,()=>{
      if(!state.busy)return;const action=chooseFreeKickAction(team,taker,spot,mates,f);state.stage='EXECUTE_'+action.kind;
      if(action.kind==='SHORT_PASS'&&action.player){const near={x:clamp(spot.x+a*42,f.left+34,f.right-34),y:clamp(spot.y+(action.player.y<spot.y?-28:28),f.top+34,f.bottom-44)};action.player.x=near.x;action.player.y=near.y;action.target={x:near.x+a*10,y:near.y+27}}
      const type=action.kind==='SHOT'?'free-kick-shot':action.kind==='LONG'?'free-kick-long':'free-kick-pass';
      strike(taker,action.target,{speed:action.kind==='SHOT'?300+(taker.skill?.shoot||.6)*65:action.kind==='LONG'?255:205,type,intended:action.player||null,curve:action.kind==='SHOT'?(Math.random()-.5)*(.18+(taker.skill?.curve||.5)*.25):0});
      taker.restartSecondTouchLock=true;taker.restartReceiveLockUntil=Number.POSITIVE_INFINITY;
      emit('futlive:free-kick',{team,taker:pid(taker),action:action.kind,target:pid(action.player),secondTouchLock:true});finish()
    });return true
  }
  function beginPenalty(team){
    if(state.busy)return false;const f=e.field(),a=attack(team),goalX=team==='blue'?f.right:f.left,goalY=(f.goalTop+f.goalBottom)/2,spot={x:goalX-a*f.w*.12,y:goalY},taker=bestTaker(team,'PENALTY',spot),g=goalkeeper(other(team));if(!taker||!g)return false;
    state.busy=true;state.exclusive=true;state.type='PENALTY';state.team=team;state.taker=taker;state.spot=spot;state.stage='POSITIONING';pause();setPhase('SET_PIECE');
    const map=new Map();map.set(taker,{x:spot.x-a*20,y:spot.y-27});map.set(g,{x:g.team==='blue'?f.left+40:f.right-40,y:goalY-27});
    for(const p of e.players){if(p===taker||p===g||p.sentOff)continue;if(p.goalkeeper)map.set(p,{x:p.team==='blue'?f.left+42:f.right-42,y:goalY-27});else map.set(p,{x:clamp(spot.x-a*(p.team===team?70:82),f.left+32,f.right-32),y:clamp(goalY+(p.slot%2?70:-70)-27,f.top+34,f.bottom-44)})}
    position(map,spot,()=>{const quality=(taker.skill?.shoot||.6)*.55+(taker.skill?.composure||.6)*.45,targetY=goalY+(Math.random()<.5?-1:1)*(28+Math.random()*24);strike(taker,{x:goalX+a*f.goalDepth,y:targetY},{speed:305+quality*80,type:'penalty-shot'});finish(360)});return true
  }
  window.addEventListener('futlive:restart',()=>{for(const p of e.players){if(p.restartSecondTouchLock&&e.ball.lastTouch&&e.ball.lastTouch!==p){delete p.restartSecondTouchLock;delete p.restartReceiveLockUntil}}});
  window.FutLiveSetPieces={state,beginFreeKick,beginPenalty,version:VERSION,authority:{fouls:'set-piece-system',boundaries:'boundary-restart-system'}};
}
boot();
})();