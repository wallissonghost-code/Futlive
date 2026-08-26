(()=>{'use strict';
const FOOT=Object.freeze({right:{x:17,y:24},left:{x:-4,y:24},up:{x:7,y:12},down:{x:7,y:31}});
const DRIBBLE=Object.freeze({right:{x:5,y:0},left:{x:-5,y:0},up:{x:0,y:-4},down:{x:0,y:4}});
function boot(){
  const e=window.FutLiveFootballEngine;if(!e||!e.players?.length){setTimeout(boot,40);return}if(e.__ballContactV038)return;e.__ballContactV038=true;
  for(const p of e.players)p.facing=p.facing||((p.team==='blue')?'right':'left');
  const originalMove=e.moveToward.bind(e);
  e.moveToward=(p,tx,ty,speed,dt)=>{const dx=tx-p.x,dy=ty-p.y;if(Math.hypot(dx,dy)>1.5){const dir=e.dirFor(dx,dy);if(['up','down','left','right'].includes(dir))p.facing=dir}return originalMove(p,tx,ty,speed,dt)};
  e.foot=(p)=>{const dir=FOOT[p.facing]?p.facing:(p.lastDir&&FOOT[p.lastDir]?p.lastDir:(p.team==='blue'?'right':'left')),o=FOOT[dir];return{x:p.x+o.x,y:p.y+o.y}};
  e.footDist=(p,b=e.ball)=>{const q=e.foot(p);return Math.hypot(q.x-b.x,q.y-b.y)};
  e.syncOwnedBall=()=>{const p=e.ball.owner;if(!p)return;const dir=FOOT[p.facing]?p.facing:(p.team==='blue'?'right':'left'),q=e.foot(p),d=DRIBBLE[dir];e.ball.x=q.x+d.x;e.ball.y=q.y+d.y};
  window.FutLiveBallContact={FOOT,DRIBBLE,contact:p=>e.foot(p),ballPoint:p=>{const dir=FOOT[p.facing]?p.facing:(p.team==='blue'?'right':'left'),q=e.foot(p),d=DRIBBLE[dir];return{x:q.x+d.x,y:q.y+d.y}}};
}
boot();
})();