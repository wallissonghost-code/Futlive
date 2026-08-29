(()=>{'use strict';
const VERSION='0.67.0';
const VALID=new Set(['up','down','left','right']);
function boot(){
  const e=window.FutLiveFootballEngine,game=document.getElementById('game');
  if(!e||!e.players?.length||!game){setTimeout(boot,45);return}
  if(e.__actionOrientationV067)return;e.__actionOrientationV067=true;
  const locks=new Map();
  const pid=p=>p?.el?.id||null,now=()=>performance.now(),attack=t=>t==='blue'?1:-1;
  const playable=()=>!window.FutLiveMatchState?.phase||window.FutLiveMatchState.phase==='PLAYING';
  function dirToPoint(p,x,y,prefer=null){
    const dx=x-p.x,dy=y-(p.y+27),ax=Math.abs(dx),ay=Math.abs(dy);
    if(ax<3&&ay<3)return prefer&&VALID.has(prefer)?prefer:(p.facing||p.lastDir||'down');
    if(ax>=ay*.88)return dx>=0?'right':'left';
    return dy>=0?'down':'up'
  }
  function dirFromVector(p,vx,vy,biasX=1){
    const rawX=Math.abs(vx),rawY=Math.abs(vy),ax=rawX*biasX,ay=rawY,prefer=p.aiActionFacing||p.ctrl?.getState?.()?.state||p.facing;
    if(rawX<2&&rawY<2)return VALID.has(prefer)?prefer:(p.team==='blue'?'right':'left');
    if(ax>ay*1.12)return vx>=0?'right':'left';
    if(ay>ax*1.22)return vy>=0?'down':'up';
    if(VALID.has(prefer)){
      if((prefer==='left'||prefer==='right')&&ax>=ay*.82)return prefer;
      if((prefer==='up'||prefer==='down')&&ay>=ax*.92)return prefer
    }
    return ax>=ay?(vx>=0?'right':'left'):(vy>=0?'down':'up')
  }
  function apply(p,dir,reason,priority=0){
    if(!p||!VALID.has(dir)||p.sentOff||p.tempSuspended)return false;
    if(p.slideFrame||p.ctrl?.state==='slide'||p.el?.dataset?.anim==='slide')return false;
    const old=locks.get(p),t=now();if(old&&old.priority>priority&&old.until>t)return false;
    locks.set(p,{dir,reason,priority,until:t+125});p.facing=dir;p.aiActionFacing=dir;p.aiActionFacingReason=reason;
    const c=p.ctrl;if(c){c.cancelPendingDirection?.();const st=c.getState?.();if(st?.state!==dir||!st?.playing)c.play?.(dir,c.fps||8,{restart:false})}
    return true
  }
  function facePoint(p,x,y,reason,priority=0,prefer=null){return apply(p,dirToPoint(p,x,y,prefer),reason,priority)}
  function playerById(id){return id?e.players.find(p=>pid(p)===id)||null:null}
  function facePasser(p){
    if(!p.aiPreparingPass)return false;const id=p.aiPassOrientation?.target,target=playerById(id);if(!target)return false;
    return facePoint(p,target.x,target.y+27,'PASS_TARGET',90,p.facing)
  }
  function faceReceiver(p){
    const b=e.ball;if(!b||b.owner||b.intended!==p)return false;const type=String(b.type||'');if(!/(pass|cross|distribution|throw-in|corner)/.test(type))return false;
    return facePoint(p,b.x,b.y,'RECEIVE_BALL',84,p.facing)
  }
  function goalkeeperFacing(g){
    const ai=window.FutLiveGoalkeeperAI,s=ai?.state?.get?.(g),mode=s?.mode||g.aiGoalkeeperMode||'SET',f=e.field(),b=e.ball;
    if(b?.owner===g){let target=s?.distribution?.to||null;if(!target&&Array.isArray(s?.candidates)&&s.candidates.length)target=playerById(s.candidates[0]?.id);if(target)return facePoint(g,target.x,target.y+27,'GK_DISTRIBUTION_TARGET',96,g.facing);return apply(g,g.team==='blue'?'right':'left','GK_WITH_BALL_FIELD',72)}
    if(mode==='SHOT_RESPONSE'||mode==='CLAIM'||mode==='ONE_V_ONE'){const target=b?.owner&&b.owner.team!==g.team?e.foot(b.owner):b;if(target)return facePoint(g,target.x,target.y,'GK_BALL_THREAT',98,g.facing)}
    if(mode==='SET'){const gx=g.team==='blue'?f.left:f.right;return facePoint(g,gx,(f.goalTop+f.goalBottom)/2,'GK_OWN_GOAL',76,g.team==='blue'?'left':'right')}
    return false
  }
  function faceCarrier(p){
    if(e.ball.owner!==p||p.goalkeeper||p.aiPreparingPass)return false;
    const v=p.aiVelocity||{x:0,y:0},a=attack(p.team),toward=(v.x||0)*a>2,bias=toward?1.28:1.08;
    let dir=dirFromVector(p,v.x||0,v.y||0,bias);
    if(Math.hypot(v.x||0,v.y||0)<7)dir=a>0?'right':'left';
    return apply(p,dir,'CARRIER_MOVEMENT',58)
  }
  function faceMovement(p){
    if(p.goalkeeper||e.ball.owner===p||e.ball.intended===p||p.aiPreparingPass)return false;
    const v=p.aiVelocity;if(!v||Math.hypot(v.x||0,v.y||0)<11)return false;
    const toward=(v.x||0)*attack(p.team)>2,bias=toward?1.14:1;
    return apply(p,dirFromVector(p,v.x||0,v.y||0,bias),'MOVEMENT_VECTOR',22)
  }
  function frame(){
    if(playable()&&!window.FutLiveSetPieces?.state?.exclusive){
      for(const p of e.players){
        if(p.sentOff||p.tempSuspended)continue;
        if(facePasser(p))continue;
        if(faceReceiver(p))continue;
        if(p.goalkeeper){goalkeeperFacing(p);continue}
        if(faceCarrier(p))continue;
        faceMovement(p)
      }
    }
    const t=now();for(const [p,l] of locks)if(l.until<t){locks.delete(p);if(p){delete p.aiActionFacing;delete p.aiActionFacingReason}}
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame);
  window.FutLiveActionOrientation={version:VERSION,locks,dirToPoint,dirFromVector,facePoint,debug:p=>({facing:p?.facing,lastDir:p?.lastDir,movementDir:p?.movementDir,action:p?.aiActionFacing,reason:p?.aiActionFacingReason,rendered:window.FutLiveBallContact?.visualDirection?.(p)||p?.ctrl?.getState?.()?.state,lock:locks.get(p)||null})};
}
boot();
})();