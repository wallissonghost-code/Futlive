(()=>{'use strict';
const VERSION='0.72';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DIR={right:[1,0],left:[-1,0],up:[0,-1],down:[0,1]};
function boot(){
  const e=window.FutLiveFootballEngine;if(!e||!e.players?.length){setTimeout(boot,50);return}if(e.__tackleV072)return;e.__tackleV072=true;
  const cooldown=new Map(),active=new Map(),vulnerable=new Map(),stats={attempts:0,clean:0,missed:0,fouls:0,rejectedRear:0,rejectedBodyFirst:0};
  const originalMove=e.moveToward.bind(e),pid=p=>p?.el?.id||null;
  e.moveToward=(p,tx,ty,speed,dt)=>{const t=performance.now();if(p?.sentOff)return 0;if(active.has(p))return Math.hypot(tx-p.x,ty-p.y);if((vulnerable.get(p)||0)>t)speed*=.48;return originalMove(p,tx,ty,speed,dt)};
  const vec=p=>{const s=active.get(p);if(s)return[s.nx,s.ny];const v=p.aiVelocity||{};if(Math.hypot(v.x||0,v.y||0)>8){const m=Math.hypot(v.x,v.y)||1;return[v.x/m,v.y/m]}return DIR[p.facing]||DIR[p.lastDir]||[p.team==='blue'?1:-1,0]};
  function emit(type,detail){window.dispatchEvent(new CustomEvent(type,{detail}))}
  function dotPoint(p,q){const f=vec(p),from=e.foot?.(p)||{x:p.x,y:p.y+27},dx=q.x-from.x,dy=q.y-from.y,m=Math.hypot(dx,dy)||1;return(f[0]*dx+f[1]*dy)/m}
  function carrierRear(p,c){const f=vec(c),dx=p.x-c.x,dy=p.y-c.y,m=Math.hypot(dx,dy)||1;return(f[0]*dx+f[1]*dy)/m<-.28}
  function urgency(p,c){const f=e.field(),brain=window.FutLiveFootballAI?.teams?.[p.team],own=p.team==='blue'?f.left:f.right,danger=1-clamp(Math.abs(c.x-own)/(f.w*.68),0,1);return(brain?.pressor===p ? .10 : 0)+(brain?.phase==='TRANSITION_DEFENSE' ? .06 : 0)+danger*.055}
  function horizontalHistory(p){const vx=p.aiVelocity?.x||0;if(Math.abs(vx)>3)return vx>0?'right':'left';const d=p.facing||p.lastDir;return d==='right'||d==='left'?d:null}
  function slideFrameFor(p,dx,dy){if(Math.abs(dx)>Math.max(5,Math.abs(dy)*.18))return dx>=0?31:32;const h=horizontalHistory(p);if(h)return h==='right'?31:32;return dx>=0?31:32}
  function holdSlideFrame(p,frame){const c=p.ctrl;if(!c)return;c.cancelPendingDirection?.();c.stop?.(false);c.state='slide';c.index=0;if(c.img&&c.src)c.img.src=c.src(frame);if(c.el){c.el.dataset.anim='slide';c.el.dataset.slideFrame=String(frame)}p.slideFrame=frame}
  function clearSlideFrame(p){if(p.ctrl?.el)delete p.ctrl.el.dataset.slideFrame;delete p.slideFrame}
  function ballPoint(c,predict=.10){const q=e.foot?.(c)||{x:c.x,y:c.y+27},v=c.aiVelocity||{x:0,y:0};return{x:q.x+(v.x||0)*predict,y:q.y+(v.y||0)*predict}}
  function geometry(p,c){const pf=e.foot?.(p)||{x:p.x,y:p.y+27},bp=ballPoint(c),body=e.dist(p,c),ball=Math.hypot(bp.x-pf.x,bp.y-pf.y),angle=dotPoint(p,bp),rear=carrierRear(p,c);return{pf,bp,body,ball,angle,rear}}
  function canAttempt(p,c,dt){
    if(window.FutLiveMatchState?.phase!=='PLAYING'||!c||e.ball.owner!==c||p.goalkeeper||p.sentOff||p===c||p.team===c.team||active.has(p))return false;
    const now=performance.now();if((cooldown.get(p)||0)>now||(vulnerable.get(p)||0)>now)return false;
    const g=geometry(p,c),def=p.skill.defend||.5,comp=p.skill.composure||.5;
    if(g.rear&&def<.82){stats.rejectedRear++;return false}
    if(g.body<20||g.body>63||g.ball>57||g.angle<.38)return false;
    if(g.body+5<g.ball){stats.rejectedBodyFirst++;return false}
    const precision=def*.46+comp*.24+clamp((57-g.ball)/42,0,1)*.22+g.angle*.18+urgency(p,c);
    const chance=clamp((precision-.34)*.30,.015,.19);
    return Math.random()<chance*dt
  }
  function start(p,c){
    if(!c||e.ball.owner!==c)return false;const pf=e.foot?.(p)||{x:p.x,y:p.y+27},bp=ballPoint(c,.13),dx=bp.x-pf.x,dy=bp.y-pf.y,m=Math.hypot(dx,dy)||1,now=performance.now(),frame=slideFrameFor(p,dx,dy),physicalDir=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
    p.facing=physicalDir;active.set(p,{owner:c,nx:dx/m,ny:dy/m,start:now,end:now+400,contact:false,frame,aimX:bp.x,aimY:bp.y});cooldown.set(p,now+3200+Math.random()*1700);stats.attempts++;
    holdSlideFrame(p,frame);p.lastDir=physicalDir;emit('futlive:tackle-start',{player:pid(p),team:p.team,target:pid(c),frame,direction:physicalDir,aim:'BALL'});return true
  }
  function finish(p,penalty=600){active.delete(p);clearSlideFrame(p);vulnerable.set(p,performance.now()+penalty);setTimeout(()=>{if(!active.has(p)&&!p.sentOff)p.ctrl?.idle?.()},Math.min(180,penalty))}
  function foul(p,c,reason='BODY_FIRST'){
    stats.fouls++;e.ball.owner=null;e.ball.type='foul-dead';e.ball.vx=e.ball.vy=0;const q=e.foot?.(c)||{x:c.x,y:c.y+27};e.ball.x=q.x;e.ball.y=q.y;
    const rear=carrierRear(p,c),intensity=clamp(.5+(rear ? .22 : 0)+(p.speed||55)/260,0,1),classification=rear||intensity>.82?'RECKLESS_FOUL':'FOUL';
    emit('futlive:tackle-result',{player:pid(p),victim:pid(c),result:classification,ballFirst:false,reason});window.dispatchEvent(new CustomEvent('futlive:foul',{detail:{classification,ballFirst:false,rear,late:false,intensity,offender:p,victim:c,x:e.ball.x,y:e.ball.y}}));finish(p,classification==='RECKLESS_FOUL'?1200:900)
  }
  function winBall(p,c,s,ballDist){
    const def=p.skill.defend||.5,comp=p.skill.composure||.5,control=c.skill.control||.5,success=clamp(.46+def*.34+comp*.16-control*.12+(18-ballDist)*.02,.42,.94);
    if(Math.random()<success){stats.clean++;e.knockLoose(c,p);if(!e.ball.owner){e.ball.vx=s.nx*(48+p.speed*.38);e.ball.vy=s.ny*(48+p.speed*.38);e.ball.type='slide-loose';e.ball.pickupLock=performance.now()+150}emit('futlive:tackle-result',{player:pid(p),victim:pid(c),result:'CLEAN_TACKLE',ballFirst:true,success:true});finish(p,460)}
    else{stats.missed++;emit('futlive:tackle-result',{player:pid(p),victim:pid(c),result:'MISSED_BALL',ballFirst:true,success:false});finish(p,820)}
  }
  function updateSlides(dt){const now=performance.now();for(const [p,s] of [...active]){const c=s.owner;if(!c||c.sentOff){finish(p);continue}holdSlideFrame(p,s.frame);p.x+=s.nx*p.speed*1.48*dt;p.y+=s.ny*p.speed*1.48*dt;if(!s.contact){const ballDist=e.footDist(p),body=e.dist(p,c);if(ballDist<=18){s.contact=true;winBall(p,c,s,ballDist);continue}if(body<=p.radius+c.radius+2&&ballDist>22){s.contact=true;foul(p,c,'BODY_BEFORE_BALL');continue}}if(now>=s.end){stats.missed++;emit('futlive:tackle-result',{player:pid(p),victim:pid(c),result:'MISSED_BALL',ballFirst:false,contact:false});finish(p,760)}}}
  let last=performance.now();function loop(t){const dt=Math.min(.04,(t-last)/1000||.016);last=t;if(window.FutLiveMatchState?.phase==='PLAYING'){const c=e.ball.owner;if(c&&!c.goalkeeper&&!c.sentOff){const candidates=e.opponents(c.team).slice().sort((a,b)=>geometry(a,c).ball-geometry(b,c).ball);for(const p of candidates){if(canAttempt(p,c,dt)){start(p,c);break}}}updateSlides(dt)}else if(active.size){for(const p of [...active.keys()])finish(p)}requestAnimationFrame(loop)}requestAnimationFrame(loop);
  window.FutLiveTackleSystem={version:VERSION,cooldown,active,vulnerable,stats,slideFrameFor,try:(id)=>{const p=e.players.find(x=>x.el.id===id),c=e.ball.owner;if(p&&c&&p.team!==c.team&&!p.sentOff)return start(p,c);return false},debug:()=>({...stats,active:[...active.keys()].map(pid),foulRate:stats.attempts?Number((stats.fouls/stats.attempts).toFixed(2)):0})};
}
boot();
})();