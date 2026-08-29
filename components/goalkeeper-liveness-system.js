(()=>{'use strict';
const VERSION='0.68.0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||!e.goalkeepers?.length||!window.FutLiveGoalkeeperAI){setTimeout(boot,50);return}
  if(e.__goalkeeperLivenessV068)return;e.__goalkeeperLivenessV068=true;
  const now=()=>performance.now(),state=new Map(),events=[];
  const playable=()=>window.FutLiveMatchState?.phase==='PLAYING'&&!window.FutLiveApp?.isPaused?.()&&!window.FutLiveSetPieces?.state?.exclusive;
  const pid=p=>p?.el?.id||null;
  function targetFor(g){
    const f=e.field(),b=e.ball,mode=g.aiGoalkeeperMode||window.FutLiveGoalkeeperAI?.debug?.(g)?.mode||'SET';
    if(b.owner===g)return null;
    if(mode==='SHOT_RESPONSE'||mode==='CLAIM'||mode==='ONE_V_ONE'){
      const q=b.owner&&b.owner.team!==g.team?e.foot(b.owner):b;return{x:q.x,y:q.y-27,mode}
    }
    if(mode==='SET'){
      const gx=g.team==='blue'?f.left:f.right,center=(f.goalTop+f.goalBottom)/2,q=b.owner?e.foot(b.owner):b,distX=Math.abs(q.x-gx),depth=clamp(distX/(f.w*.42),0,1),stepOut=(1-depth)*(f.w*.045),x=g.team==='blue'?gx+18+stepOut:gx-18-stepOut,lateral=clamp((q.y-center)*.34,-(f.goalBottom-f.goalTop)*.34,(f.goalBottom-f.goalTop)*.34),y=clamp(center-27+lateral,f.goalTop+6,f.goalBottom-34);return{x,y,mode}
    }
    return null
  }
  function desiredDir(g,q){if(!q)return g.team==='blue'?'right':'left';const dx=q.x-g.x,dy=q.y-g.y;if(Math.abs(dx)>=Math.abs(dy)*.9)return dx>=0?'right':'left';return dy>=0?'down':'up'}
  function note(g,type,detail={}){const ev={at:now(),goalkeeper:pid(g),team:g.team,type,...detail};events.push(ev);if(events.length>120)events.shift();window.dispatchEvent(new CustomEvent('futlive:goalkeeper-liveness',{detail:ev}));window.FutLiveMatchDiagnostics?.mark?.('goalkeeper-liveness',ev)}
  for(const g of e.goalkeepers)state.set(g,{x:g.x,y:g.y,lastMovedAt:now(),lastVisualAt:now(),lastFrame:g.ctrl?.getState?.()?.frame||null,physicalRecoveries:0,visualRecoveries:0,lastRecoveryAt:0});
  let last=now();
  function frame(t){
    const dt=Math.min(.05,Math.max(.001,(t-last)/1000));last=t;
    if(playable())for(const g of e.goalkeepers){
      if(g.sentOff||g.tempSuspended)continue;const s=state.get(g),q=targetFor(g),mode=g.aiGoalkeeperMode||window.FutLiveGoalkeeperAI?.debug?.(g)?.mode||'SET',owner=e.ball.owner===g;
      const moved=Math.hypot(g.x-s.x,g.y-s.y);if(moved>.45){s.x=g.x;s.y=g.y;s.lastMovedAt=t}
      const ctrl=g.ctrl?.getState?.(),frameNo=ctrl?.frame;if(frameNo!==s.lastFrame){s.lastFrame=frameNo;s.lastVisualAt=t}
      if(owner)continue;
      const targetDist=q?Math.hypot(q.x-g.x,q.y-g.y):0,vel=Math.hypot(g.aiVelocity?.x||0,g.aiVelocity?.y||0),shouldMove=!!q&&targetDist>10&&(vel>5||['SHOT_RESPONSE','CLAIM','ONE_V_ONE'].includes(mode)||targetDist>18);
      if(shouldMove&&t-s.lastMovedAt>900&&t-s.lastRecoveryAt>750){
        s.lastRecoveryAt=t;s.physicalRecoveries++;note(g,'PHYSICAL_FREEZE_RECOVERY',{mode,targetDist:+targetDist.toFixed(1),velocity:+vel.toFixed(1)});
        g.aiVelocity={x:0,y:0};e.moveToward(g,q.x,q.y,g.speed*.92,Math.max(.035,dt));s.x=g.x;s.y=g.y;s.lastMovedAt=t
      }
      const physicallyMoving=moved>.55||vel>9;
      if(physicallyMoving&&(!ctrl?.playing||!['up','down','left','right'].includes(ctrl?.state))&&t-s.lastVisualAt>320&&t-s.lastRecoveryAt>220){
        const dir=window.FutLiveActionOrientation?.dirToPoint?.(g,q?.x??g.x+(g.team==='blue'?20:-20),(q?.y??g.y)+27,g.facing)||desiredDir(g,q);s.visualRecoveries++;s.lastRecoveryAt=t;s.lastVisualAt=t;note(g,'VISUAL_FREEZE_RECOVERY',{mode,dir,ctrlState:ctrl?.state||null});g.ctrl?.cancelPendingDirection?.();g.ctrl?.play?.(dir,g.ctrl?.fps||8,{restart:false});g.facing=dir;g.lastDir=dir
      }
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame);
  window.FutLiveGoalkeeperLiveness={version:VERSION,state,events,targetFor,debug:()=>({events:[...events],goalkeepers:Object.fromEntries(e.goalkeepers.map(g=>{const s=state.get(g);return[pid(g),{mode:g.aiGoalkeeperMode||null,x:g.x,y:g.y,physicalRecoveries:s.physicalRecoveries,visualRecoveries:s.visualRecoveries,lastMovedAgo:Math.round(now()-s.lastMovedAt),ctrl:g.ctrl?.getState?.()||null}]}))})};
}
boot();
})();