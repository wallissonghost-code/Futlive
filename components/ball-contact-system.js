(()=>{'use strict';
const VERSION='0.67.0';
const FOOT=Object.freeze({right:{x:17,y:24},left:{x:-4,y:24},up:{x:7,y:12},down:{x:7,y:31}});
const DRIBBLE=Object.freeze({right:{x:5,y:0},left:{x:-5,y:0},up:{x:0,y:-4},down:{x:0,y:4}});
const DIR=new Set(['up','down','left','right']),BALL_FOLLOW=0.24;
function ensureOutOfPlay(){if(document.querySelector('script[data-futlive-outofplay]'))return;const s=document.createElement('script');s.src='./components/out-of-play-system.js?v=0.67-out1';s.dataset.futliveOutofplay='1';document.head.appendChild(s)}
function boot(){
  const e=window.FutLiveFootballEngine;if(!e||!e.players?.length){setTimeout(boot,40);return}if(e.__ballContactV067){ensureOutOfPlay();return}e.__ballContactV067=true;
  for(const p of e.players)p.facing=p.facing||((p.team==='blue')?'right':'left');
  function visualDirection(p){
    const st=p?.ctrl?.getState?.()?.state;
    if(DIR.has(st))return st;
    if(DIR.has(p?.aiActionFacing))return p.aiActionFacing;
    const anim=p?.el?.dataset?.anim;if(DIR.has(anim))return anim;
    if(DIR.has(p?.facing))return p.facing;
    if(DIR.has(p?.lastDir))return p.lastDir;
    return p?.team==='red'?'left':'right'
  }
  const originalMove=e.moveToward.bind(e);
  e.moveToward=(p,tx,ty,speed,dt)=>{
    const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);
    if(d>1.5){const dir=e.dirFor(dx,dy);if(DIR.has(dir)){p.movementDir=dir;p.aiMoveVector={x:dx/d,y:dy/d}}}
    const r=originalMove(p,tx,ty,speed,dt);
    // A direção física pode mudar antes do sprite por debounce. facing deve refletir o que está realmente desenhado.
    const rendered=visualDirection(p);if(DIR.has(rendered))p.facing=rendered;
    return r
  };
  e.foot=(p)=>{const dir=visualDirection(p),o=FOOT[dir]||FOOT[p?.team==='red'?'left':'right'];return{x:p.x+o.x,y:p.y+o.y}};
  e.footDist=(p,b=e.ball)=>{const q=e.foot(p);return Math.hypot(q.x-b.x,q.y-b.y)};
  let lastOwner=null,lastDir=null;
  e.syncOwnedBall=()=>{
    const p=e.ball.owner;
    if(!p){lastOwner=null;lastDir=null;return}
    const dir=visualDirection(p),q=e.foot(p),dr=DRIBBLE[dir]||DRIBBLE.right,tx=q.x+dr.x,ty=q.y+dr.y;
    p.facing=dir;
    if(lastOwner!==p||lastDir!==dir||!Number.isFinite(e.ball.x)||!Number.isFinite(e.ball.y)){
      // Mudou o frame/direção: reposiciona imediatamente para nunca deixar a bola no lado oposto do corpo.
      e.ball.x=tx;e.ball.y=ty;lastOwner=p;lastDir=dir;return;
    }
    const dx=tx-e.ball.x,dy=ty-e.ball.y,dist=Math.hypot(dx,dy);
    if(dist>48){e.ball.x=tx;e.ball.y=ty;return}
    const k=dist>18?0.34:BALL_FOLLOW;e.ball.x+=dx*k;e.ball.y+=dy*k;
  };
  window.FutLiveBallContact={version:VERSION,FOOT,DRIBBLE,visualDirection,contact:p=>e.foot(p),ballPoint:p=>{const dir=visualDirection(p),q=e.foot(p),d=DRIBBLE[dir]||DRIBBLE.right;return{x:q.x+d.x,y:q.y+d.y}}};
  ensureOutOfPlay();
}
boot();
})();