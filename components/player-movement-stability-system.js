(()=>{'use strict';
const VERSION='0.60.1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const now=()=>performance.now();
const attack=t=>t==='blue'?1:-1;
function boot(){
  const e=window.FutLiveFootballEngine,pi=window.FutLivePlayerIntelligence,gkai=window.FutLiveGoalkeeperAI;
  if(!e||!e.players?.length||!pi||!gkai){setTimeout(boot,45);return}
  if(e.__movementStabilityV0601)return;e.__movementStabilityV0601=true;

  /* 1) Os quatro jogadores adicionados deixam de cair no fallback BALANCED. */
  const roleById={player11:'wing',player12:'support',player13:'wing',player14:'support'};
  for(const p of e.players){
    const role=roleById[p.el?.id];
    if(!role)continue;
    p.personality=role;
    p.aiProfile=null;
    pi.profile(p);
  }

  /* 2) Histerese visual. O corpo não troca de direção por microcorreção de steering. */
  const visual=new Map();
  for(const p of e.players){
    if(!p.ctrl||p.ctrl.__stableDirectionWrapped)continue;
    p.ctrl.__stableDirectionWrapped=true;
    const rawMove=p.ctrl.move.bind(p.ctrl),rawIdle=p.ctrl.idle.bind(p.ctrl);
    visual.set(p,{dir:p.lastDir&&p.lastDir!=='idle'?p.lastDir:(p.team==='blue'?'right':'left'),candidate:null,candidateAt:0,lastSwitch:0,lastMoveAt:0});
    p.ctrl.move=(dir)=>{
      const s=visual.get(p),t=now();
      if(!s)return rawMove(dir);
      s.lastMoveAt=t;
      if(!dir||dir==='idle')return p.ctrl;
      if(dir===s.dir){s.candidate=null;s.candidateAt=0;return rawMove(dir)}
      if(s.candidate!==dir){s.candidate=dir;s.candidateAt=t;return p.ctrl}
      const hold=p.goalkeeper?150:260,confirm=p.goalkeeper?90:150;
      if(t-s.lastSwitch<hold||t-s.candidateAt<confirm)return p.ctrl;
      s.dir=dir;s.lastSwitch=t;s.candidate=null;s.candidateAt=0;return rawMove(dir)
    };
    p.ctrl.idle=()=>{const s=visual.get(p);if(s){s.candidate=null;s.candidateAt=0}return rawIdle()};
  }

  const oldOwned=e.ownedAI.bind(e),oldFree=e.freeAI.bind(e),oldGK=e.updateGoalkeepers.bind(e);

  /* 3) IA de decisão só existe enquanto a bola está realmente em jogo. */
  const playable=()=>!window.FutLiveMatchState?.phase||window.FutLiveMatchState.phase==='PLAYING';

  function extraAttackMovement(dt,f){
    const carrier=e.ball.owner;if(!carrier||carrier.goalkeeper)return;
    const a=attack(carrier.team),mates=e.players.filter(p=>p.team===carrier.team&&!p.goalkeeper&&!p.sentOff&&!p.tempSuspended&&p!==carrier);
    for(const p of mates){
      let tx=null,ty=null,mul=.20;
      if(p.personality==='wing'){
        const upper=p.home?.[1]<.5;
        tx=carrier.x+a*112;
        ty=clamp(f.h*p.home[1]+(upper?-18:18),f.top+30,f.bottom-42);
        mul=.26;
      }else if(p.personality==='creator'){
        tx=carrier.x-a*38;
        ty=clamp(carrier.y+(f.h*p.home[1]-carrier.y)*.44,f.top+30,f.bottom-42);
        mul=.22;
      }
      if(tx===null)continue;
      tx=clamp(tx,f.left+32,f.right-32);
      const d=Math.hypot(tx-p.x,ty-p.y);
      if(d<24)continue;
      e.moveToward(p,tx,ty,p.speed*mul,dt);
    }
  }

  e.ownedAI=(dt,f)=>{
    if(!playable())return;
    oldOwned(dt,f);
    if(e.ball.owner&&!e.ball.owner.goalkeeper)extraAttackMovement(dt,f);
  };
  e.freeAI=(dt,f)=>{if(!playable())return;oldFree(dt,f)};

  /* 4) Goleiro: em SET não persegue cada pixel da bola. Respostas críticas continuam intactas. */
  const gkStable=new Map();
  function faceBall(g){
    const s=visual.get(g);if(!s)return;
    const fx=e.ball.x-g.x,fy=e.ball.y-(g.y+27);
    let dir;
    if(Math.abs(fx)>Math.abs(fy)*1.20)dir=fx>=0?'right':'left';
    else dir=fy>=0?'down':'up';
    g.facing=dir;
    if(g.lastDir!==dir){g.lastDir=dir;g.ctrl.move(dir)}
  }
  e.updateGoalkeepers=(dt,f)=>{
    if(!playable())return;
    const before=new Map(e.goalkeepers.map(g=>[g,{x:g.x,y:g.y}]));
    oldGK(dt,f);
    const t=now();
    for(const g of e.goalkeepers){
      if(g.sentOff)continue;
      let s=gkStable.get(g);if(!s){s={anchorY:g.y,lastAnchorAt:t};gkStable.set(g,s)}
      const mode=g.aiGoalkeeperMode||gkai.debug?.(g)?.mode||'SET';
      if(mode==='SET'){
        const delta=g.y-s.anchorY;
        if(Math.abs(delta)>=14||t-s.lastAnchorAt>=240){
          s.anchorY+=delta*.48;s.lastAnchorAt=t;
        }
        g.y=s.anchorY;
      }else{
        s.anchorY=g.y;s.lastAnchorAt=t;
      }
      g.y=clamp(g.y,f.top+12,f.bottom-42);
      faceBall(g);
    }
  };

  window.FutLiveMovementStability={
    version:VERSION,
    roles:roleById,
    visual,
    goalkeeper:gkStable,
    debug:()=>({roles:Object.fromEntries(e.players.map(p=>[p.el?.id,p.personality])),phase:window.FutLiveMatchState?.phase||null})
  };
}
boot();
})();