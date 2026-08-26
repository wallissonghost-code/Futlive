(()=>{'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DIR={right:[1,0],left:[-1,0],up:[0,-1],down:[0,1]};
function boot(){
  const e=window.FutLiveFootballEngine;if(!e||!e.players?.length){setTimeout(boot,50);return}if(e.__tackleV038)return;e.__tackleV038=true;
  const cooldown=new Map(),active=new Map(),vulnerable=new Map();
  const originalMove=e.moveToward.bind(e),originalOwned=e.ownedAI.bind(e);
  e.moveToward=(p,tx,ty,speed,dt)=>{const t=performance.now();if(active.has(p))return Math.hypot(tx-p.x,ty-p.y);if((vulnerable.get(p)||0)>t)speed*=.48;return originalMove(p,tx,ty,speed,dt)};
  function emotionAttempt(p){const s=p.emotionState||'calm';return s==='angry'?.16:s==='motivated'?.07:s==='focused'?-.08:s==='demotivated'?-.12:s==='cocky'?.08:0}
  function riskAllowance(p){const s=p.emotionState||'calm';return s==='angry'?12:s==='cocky'?8:s==='motivated'?4:s==='focused'?-8:s==='demotivated'?-6:0}
  function facingDot(p,target){const f=DIR[p.facing]||[p.team==='blue'?1:-1,0],dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1;return(f[0]*dx+f[1]*dy)/d}
  function canAttempt(p,c,dt){
    if(p.goalkeeper||p===c||p.team===c.team||active.has(p))return false;const now=performance.now();if((cooldown.get(p)||0)>now||(vulnerable.get(p)||0)>now)return false;
    const d=e.dist(p,c),allow=riskAllowance(p);if(d<24||d>62+allow)return false;const dot=facingDot(p,c);if(dot<(.28-(allow>0?.08:0)))return false;
    const defend=p.skill.defend||.5,composure=p.skill.composure||.5,speed=clamp((p.speed-45)/45,0,1),geometry=clamp((62+allow-d)/42,0,1);
    const perSecond=.06+defend*.09+speed*.05+composure*.04+geometry*.05+emotionAttempt(p);return Math.random()<Math.max(0,perSecond)*dt
  }
  function start(p,c){
    const dx=c.x-p.x,dy=c.y-p.y,d=Math.hypot(dx,dy)||1,now=performance.now();p.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
    const rec={owner:c,nx:dx/d,ny:dy/d,start:now,end:now+360,contact:false,failed:false,success:false};active.set(p,rec);cooldown.set(p,now+4400+Math.random()*1800);p.ctrl.slide();p.lastDir='slide'
  }
  function finish(p,s,missPenalty=0){const now=performance.now();active.delete(p);vulnerable.set(p,now+missPenalty);if(missPenalty>500)p.ctrl.idle()}
  function updateSlides(dt){
    const now=performance.now();for(const [p,s] of [...active]){
      // Após acertar/errar, mantém o bloqueio de movimento até completar os frames 31-32.
      if(!s.failed&&!s.success&&(!e.ball.owner||e.ball.owner!==s.owner)){finish(p,s,360);continue}
      p.x+=s.nx*p.speed*(s.failed?.72:1.62)*dt;p.y+=s.ny*p.speed*(s.failed?.72:1.62)*dt;
      if(!s.failed&&!s.success){
        const owner=s.owner,ballDist=e.footDist(p),body=e.dist(p,owner);
        if(!s.contact&&(ballDist<=16||body<=p.radius+owner.radius+4)){
          s.contact=true;const defend=p.skill.defend||.5,comp=p.skill.composure||.5,control=owner.skill.control||.5,angle=clamp(facingDot(p,owner),0,1),reach=clamp(1-ballDist/20,0,1);
          const successChance=clamp(.18+defend*.38+comp*.16+angle*.16+reach*.16-control*.20,.12,.88);
          if(Math.random()<successChance){s.success=true;e.knockLoose(owner,p);if(e.ball.owner===null){e.ball.vx=s.nx*(55+p.speed*.45);e.ball.vy=s.ny*(55+p.speed*.45);e.ball.type='slide-loose';e.ball.pickupLock=now+150}}
          else{s.failed=true;s.end=Math.max(s.end,now+180)}
        }
      }
      if(now>=s.end)finish(p,s,s.failed?920:360)
    }
  }
  e.ownedAI=(dt,f)=>{
    if(window.FutLiveMatchState&&window.FutLiveMatchState.phase!=='PLAYING')return;
    const c=e.ball.owner;if(c&&!c.goalkeeper){for(const p of e.opponents(c.team))if(canAttempt(p,c,dt)){start(p,c);break}}
    originalOwned(dt,f);updateSlides(dt);for(const p of e.players){if(!p.goalkeeper){p.x=e.clamp(p.x,f.left+p.radius,f.right-p.radius);p.y=e.clamp(p.y,f.top+p.radius,f.bottom-p.radius)}}
  };
  const originalFree=e.freeAI.bind(e);e.freeAI=(dt,f)=>{if(window.FutLiveMatchState&&window.FutLiveMatchState.phase!=='PLAYING')return;originalFree(dt,f);updateSlides(dt)};
  window.FutLiveTackleSystem={cooldown,active,vulnerable,try:(playerId)=>{const p=e.players.find(x=>x.el.id===playerId),c=e.ball.owner;if(p&&c&&p.team!==c.team){start(p,c);return true}return false}};
}
boot();
})();