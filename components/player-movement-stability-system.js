(()=>{'use strict';
const VERSION='0.61.0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const now=()=>performance.now();
const attack=t=>t==='blue'?1:-1;
function boot(){
  const e=window.FutLiveFootballEngine,pi=window.FutLivePlayerIntelligence,gkai=window.FutLiveGoalkeeperAI;
  if(!e||!e.players?.length||!pi||!gkai){setTimeout(boot,45);return}
  if(e.__movementStabilityV0610)return;e.__movementStabilityV0610=true;

  const roleById={player11:'wing',player12:'support',player13:'wing',player14:'support'};
  for(const p of e.players){const role=roleById[p.el?.id];if(!role)continue;p.personality=role;p.aiProfile=null;pi.profile(p)}

  const visual=new Map();
  for(const p of e.players){
    if(!p.ctrl||p.ctrl.__stableDirectionWrapped)continue;p.ctrl.__stableDirectionWrapped=true;
    const rawMove=p.ctrl.move.bind(p.ctrl),rawIdle=p.ctrl.idle.bind(p.ctrl);
    visual.set(p,{dir:p.lastDir&&p.lastDir!=='idle'?p.lastDir:(p.team==='blue'?'right':'left'),candidate:null,candidateAt:0,lastSwitch:0,lastMoveAt:0});
    p.ctrl.move=(dir)=>{const s=visual.get(p),t=now();if(!s)return rawMove(dir);s.lastMoveAt=t;if(!dir||dir==='idle')return p.ctrl;if(dir===s.dir){s.candidate=null;s.candidateAt=0;return rawMove(dir)}if(s.candidate!==dir){s.candidate=dir;s.candidateAt=t;return p.ctrl}const hold=p.goalkeeper?150:260,confirm=p.goalkeeper?90:150;if(t-s.lastSwitch<hold||t-s.candidateAt<confirm)return p.ctrl;s.dir=dir;s.lastSwitch=t;s.candidate=null;s.candidateAt=0;return rawMove(dir)};
    p.ctrl.idle=()=>{const s=visual.get(p);if(s){s.candidate=null;s.candidateAt=0}return rawIdle()};
  }

  /* PRE_MATCH guard: impede a antiga encenação no centro de chegar à tela. */
  const rawPaint=e.paint.bind(e);
  e.paint=()=>{
    const phase=window.FutLiveMatchState?.phase;
    if(phase==='PRE_MATCH'){
      const f=e.field();
      for(const p of e.players){
        const hx=f.w*(p.home?.[0]??.5),hy=f.h*(p.home?.[1]??.5);
        const staging=Math.abs(p.x-f.w*.5)<95&&!p.__allowPrematchCenter;
        if(staging){p.x=hx;p.y=hy;p.aiVelocity={x:0,y:0};p.lastDir='idle'}
      }
    }
    return rawPaint();
  };

  const oldOwned=e.ownedAI.bind(e),oldFree=e.freeAI.bind(e),oldGK=e.updateGoalkeepers.bind(e);
  const playable=()=>!window.FutLiveMatchState?.phase||window.FutLiveMatchState.phase==='PLAYING';

  function extraAttackMovement(dt,f){
    const carrier=e.ball.owner;if(!carrier||carrier.goalkeeper)return;
    const a=attack(carrier.team),mates=e.players.filter(p=>p.team===carrier.team&&!p.goalkeeper&&!p.sentOff&&!p.tempSuspended&&p!==carrier);
    for(const p of mates){let tx=null,ty=null,mul=.20;if(p.personality==='wing'){const upper=p.home?.[1]<.5;tx=carrier.x+a*112;ty=clamp(f.h*p.home[1]+(upper?-18:18),f.top+30,f.bottom-42);mul=.26}else if(p.personality==='creator'){tx=carrier.x-a*38;ty=clamp(carrier.y+(f.h*p.home[1]-carrier.y)*.44,f.top+30,f.bottom-42);mul=.22}if(tx===null)continue;tx=clamp(tx,f.left+32,f.right-32);const d=Math.hypot(tx-p.x,ty-p.y);if(d<24)continue;e.moveToward(p,tx,ty,p.speed*mul,dt)}
  }

  e.ownedAI=(dt,f)=>{if(!playable())return;oldOwned(dt,f);if(e.ball.owner&&!e.ball.owner.goalkeeper)extraAttackMovement(dt,f)};
  e.freeAI=(dt,f)=>{if(!playable())return;oldFree(dt,f)};

  const gkStable=new Map();
  function faceBall(g){const s=visual.get(g);if(!s)return;const fx=e.ball.x-g.x,fy=e.ball.y-(g.y+27);let dir;if(Math.abs(fx)>Math.abs(fy)*1.20)dir=fx>=0?'right':'left';else dir=fy>=0?'down':'up';g.facing=dir;if(g.lastDir!==dir){g.lastDir=dir;g.ctrl.move(dir)}}
  function holdPose(g){
    const dir=g.team==='blue'?'right':'left',a=attack(g.team),ctrl=g.ctrl;
    ctrl?.cancelPendingDirection?.();ctrl?.stop?.(false);ctrl?.setState?.(dir,{restart:false});ctrl?.show?.(0);
    g.lastDir=dir;g.facing=dir;
    if(e.ball.owner===g){e.ball.x=g.x+a*13;e.ball.y=g.y+16}
  }
  e.updateGoalkeepers=(dt,f)=>{
    if(!playable())return;oldGK(dt,f);const t=now();
    for(const g of e.goalkeepers){
      if(g.sentOff)continue;let s=gkStable.get(g);if(!s){s={anchorY:g.y,lastAnchorAt:t};gkStable.set(g,s)}
      const mode=g.aiGoalkeeperMode||gkai.debug?.(g)?.mode||'SET';
      if(e.ball.owner===g&&['HOLD','SCAN','CALL_SUPPORT'].includes(mode)){s.anchorY=g.y;s.lastAnchorAt=t;holdPose(g);continue}
      if(mode==='SET'){const delta=g.y-s.anchorY;if(Math.abs(delta)>=14||t-s.lastAnchorAt>=240){s.anchorY+=delta*.48;s.lastAnchorAt=t}g.y=s.anchorY}else{s.anchorY=g.y;s.lastAnchorAt=t}
      g.y=clamp(g.y,f.top+12,f.bottom-42);faceBall(g)
    }
  };

  /* Tether tático: permite atacar, mas força recomposição quando um jogador abandona sua zona. */
  let recoveryLast=performance.now();
  function communicationExempts(p){const intent=window.FutLiveTeamCommunication?.get?.(p.team);return !!intent?.targets?.some?.(t=>t.p===p)}
  function nearestToPlay(team){const target=e.ball.owner||e.ball;return e.players.filter(p=>p.team===team&&!p.goalkeeper&&!p.sentOff&&!p.tempSuspended).map(p=>({p,d:e.dist(p,target)})).sort((a,b)=>a.d-b.d)}
  function formationRecovery(t){
    const phase=window.FutLiveMatchState?.phase,dt=Math.min(.05,Math.max(0,(t-recoveryLast)/1000));recoveryLast=t;
    if(phase==='PLAYING'&&dt>0){const f=e.field(),owner=e.ball.owner,ballShift=(e.ball.x-f.w*.5);for(const team of ['blue','red']){const rank=nearestToPlay(team),primary=rank[0]?.p,cover=rank[1]?.p,hasBall=owner?.team===team;for(const p of e.players){if(p.team!==team||p.goalkeeper||p.sentOff||p.tempSuspended||p===owner||p===primary||communicationExempts(p))continue;const hx=f.w*(p.home?.[0]??.5),hy=f.h*(p.home?.[1]??.5),shift=ballShift*(hasBall?.13:.065),ax=clamp(hx+shift,f.left+42,f.right-42),ay=clamp(hy+(e.ball.y-f.h*.5)*.055,f.top+36,f.bottom-50),d=Math.hypot(p.x-ax,p.y-ay);let max=p.personality==='finisher'?165:p.personality==='wing'?150:p.personality==='support'?125:130;if(!hasBall)max-=28;if(p===cover)max+=42;if(d>max){const dx=ax-p.x,dy=ay-p.y,m=Math.hypot(dx,dy)||1,step=Math.min(d-max,p.speed*(hasBall?.72:.92)*dt);p.x+=dx/m*step;p.y+=dy/m*step;p.aiRecovery={active:true,homeDistance:Number(d.toFixed(1)),limit:max,target:{x:Number(ax.toFixed(1)),y:Number(ay.toFixed(1))}}}else p.aiRecovery={active:false,homeDistance:Number(d.toFixed(1)),limit:max}}}}
    requestAnimationFrame(formationRecovery)
  }
  requestAnimationFrame(formationRecovery);

  window.FutLiveMovementStability={version:VERSION,roles:roleById,visual,goalkeeper:gkStable,debug:()=>({roles:Object.fromEntries(e.players.map(p=>[p.el?.id,p.personality])),phase:window.FutLiveMatchState?.phase||null,recovery:Object.fromEntries(e.players.filter(p=>!p.goalkeeper).map(p=>[p.el?.id,p.aiRecovery||null]))})};
}
boot();
})();