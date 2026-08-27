(()=>{'use strict';
const FOOT=Object.freeze({right:{x:17,y:24},left:{x:-4,y:24},up:{x:7,y:12},down:{x:7,y:31}});
const DRIBBLE=Object.freeze({right:{x:5,y:0},left:{x:-5,y:0},up:{x:0,y:-4},down:{x:0,y:4}});
const BALL_FOLLOW=0.24;
function boot(){
  const e=window.FutLiveFootballEngine;if(!e||!e.players?.length){setTimeout(boot,40);return}if(e.__ballContactV053)return;e.__ballContactV053=true;
  for(const p of e.players)p.facing=p.facing||((p.team==='blue')?'right':'left');
  const originalMove=e.moveToward.bind(e);
  e.moveToward=(p,tx,ty,speed,dt)=>{const dx=tx-p.x,dy=ty-p.y;if(Math.hypot(dx,dy)>1.5){const dir=e.dirFor(dx,dy);if(['up','down','left','right'].includes(dir))p.facing=dir}return originalMove(p,tx,ty,speed,dt)};
  e.foot=(p)=>{const dir=FOOT[p.facing]?p.facing:(p.lastDir&&FOOT[p.lastDir]?p.lastDir:(p.team==='blue'?'right':'left')),o=FOOT[dir];return{x:p.x+o.x,y:p.y+o.y}};
  e.footDist=(p,b=e.ball)=>{const q=e.foot(p);return Math.hypot(q.x-b.x,q.y-b.y)};
  let lastOwner=null;
  e.syncOwnedBall=()=>{
    const p=e.ball.owner;
    if(!p){lastOwner=null;return}
    const dir=FOOT[p.facing]?p.facing:(p.team==='blue'?'right':'left'),q=e.foot(p),d=DRIBBLE[dir],tx=q.x+d.x,ty=q.y+d.y;
    if(lastOwner!==p||!Number.isFinite(e.ball.x)||!Number.isFinite(e.ball.y)){
      e.ball.x=tx;e.ball.y=ty;lastOwner=p;return;
    }
    const dx=tx-e.ball.x,dy=ty-e.ball.y,dist=Math.hypot(dx,dy);
    if(dist>48){e.ball.x=tx;e.ball.y=ty;return}
    const k=dist>18?0.34:BALL_FOLLOW;
    e.ball.x+=dx*k;e.ball.y+=dy*k;
  };
  window.FutLiveBallContact={FOOT,DRIBBLE,contact:p=>e.foot(p),ballPoint:p=>{const dir=FOOT[p.facing]?p.facing:(p.team==='blue'?'right':'left'),q=e.foot(p),d=DRIBBLE[dir];return{x:q.x+d.x,y:q.y+d.y}}};
}
boot();
})();