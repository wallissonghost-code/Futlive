(()=>{'use strict';
const VERSION='0.18';
class FutLiveFootballEngine{
  constructor({game='#game',ball='.ball'}={}){
    this.game=typeof game==='string'?document.querySelector(game):game;
    this.ballEl=typeof ball==='string'?document.querySelector(ball):ball;
    this.controllers=[];this.players=[];this.ball={x:0,y:0,vx:0,vy:0,owner:null};
    this.score={blue:1,red:0};this.last=0;this.raf=0;this.started=false;this.shotLock=0;
    this.formation={blue:[[.24,.40],[.34,.57],[.43,.30]],red:[[.76,.57],[.66,.36],[.57,.66]]};
  }
  start(){if(this.started||!this.game||!this.ballEl)return false;const bag=window.FutLivePlayers;if(!bag?.team1?.length||!bag?.team2?.length)return false;
    this.controllers=[...bag.team1,...bag.team2];
    const rect=this.game.getBoundingClientRect();
    this.players=this.controllers.map((ctrl,i)=>{const team=i<3?'blue':'red',slot=i%3,pos=this.formation[team][slot];const el=ctrl.el;el.style.right='auto';return{ctrl,el,team,slot,x:rect.width*pos[0],y:rect.height*pos[1],speed:team==='blue'?86:84,lastDir:'idle'}});
    this.resetBall();this.renderScore();this.started=true;this.last=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t));window.FutLiveFootballEngine=this;return true}
  field(){const r=this.game.getBoundingClientRect(),hud=document.getElementById('liveGiftHud'),hudTop=hud?hud.getBoundingClientRect().top-r.top:r.height*.78;return{w:r.width,h:r.height,left:r.width*.055,right:r.width*.945,top:r.height*.10,bottom:Math.max(r.height*.60,hudTop-18),goalTop:r.height*.36,goalBottom:r.height*.64}}
  resetBall(){const f=this.field();this.ball.x=(f.left+f.right)/2;this.ball.y=(f.top+f.bottom)/2;this.ball.vx=0;this.ball.vy=0;this.ball.owner=null;this.players.forEach(p=>{const q=this.formation[p.team][p.slot];p.x=f.w*q[0];p.y=f.h*q[1];p.ctrl.idle()});this.paint()}
  dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  dirFor(dx,dy){if(Math.abs(dx)>Math.abs(dy))return dx>0?'right':'left';return dy>0?'down':'up'}
  animate(p,dx,dy){const d=this.dirFor(dx,dy);if(p.lastDir!==d){p.lastDir=d;p.ctrl.move(d)}}
  moveToward(p,tx,ty,speed,dt){const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);if(d<1){if(p.lastDir!=='idle'){p.lastDir='idle';p.ctrl.idle()}return d}const step=Math.min(d,speed*dt);p.x+=dx/d*step;p.y+=dy/d*step;this.animate(p,dx,dy);return d}
  nearest(team,target){let best=null,bd=Infinity;for(const p of this.players){if(p.team!==team)continue;const d=this.dist(p,target);if(d<bd){bd=d;best=p}}return{p:best,d:bd}}
  updateFree(dt,f){const target=this.ball;const b=this.nearest('blue',target),r=this.nearest('red',target);if(b.p)this.moveToward(b.p,target.x,target.y,b.p.speed*1.18,dt);if(r.p)this.moveToward(r.p,target.x,target.y,r.p.speed*1.18,dt);
    for(const p of this.players){if(p===b.p||p===r.p)continue;const home=this.formation[p.team][p.slot];const shift=(this.ball.x-f.w*.5)*.12;this.moveToward(p,f.w*home[0]+shift,f.h*home[1],p.speed*.55,dt)}
    const candidate=b.d<=r.d?b:r;if(candidate.p&&candidate.d<22){this.ball.owner=candidate.p;this.ball.vx=this.ball.vy=0}
    this.ball.x+=this.ball.vx*dt;this.ball.y+=this.ball.vy*dt;this.ball.vx*=Math.pow(.25,dt);this.ball.vy*=Math.pow(.25,dt)}
  updateOwned(dt,f){const p=this.ball.owner;if(!p)return;const goalX=p.team==='blue'?f.right:f.left,goalY=(f.goalTop+f.goalBottom)/2;const attackDir=p.team==='blue'?1:-1;
    const opp=this.nearest(p.team==='blue'?'red':'blue',p);if(opp.p)this.moveToward(opp.p,p.x,p.y,opp.p.speed*1.06,dt);
    const carrierTargetX=goalX-attackDir*55;this.moveToward(p,carrierTargetX,goalY,p.speed*1.08,dt);
    this.ball.x=p.x+attackDir*15;this.ball.y=p.y+5;
    for(const q of this.players){if(q===p||q===opp.p)continue;const home=this.formation[q.team][q.slot];const bonus=q.team===p.team?attackDir*28:0;this.moveToward(q,f.w*home[0]+bonus,f.h*home[1],q.speed*.58,dt)}
    if(opp.p&&this.dist(opp.p,p)<18&&Math.random()<dt*.9){this.ball.owner=opp.p;return}
    const goalDist=Math.abs(goalX-p.x);if(goalDist<Math.max(115,f.w*.28)&&performance.now()>this.shotLock){this.shoot(p,f)}}
  shoot(p,f){const goalX=p.team==='blue'?f.right+18:f.left-18;const spread=(Math.random()-.5)*(f.goalBottom-f.goalTop)*.68;const goalY=(f.goalTop+f.goalBottom)/2+spread;const dx=goalX-p.x,dy=goalY-p.y,d=Math.hypot(dx,dy)||1;const power=270+Math.random()*80;this.ball.owner=null;this.ball.x=p.x+(p.team==='blue'?15:-15);this.ball.y=p.y;this.ball.vx=dx/d*power;this.ball.vy=dy/d*power;this.shotLock=performance.now()+900;p.ctrl.kick();p.lastDir='kick'}
  physics(dt,f){if(this.ball.owner)return;this.ball.x+=this.ball.vx*dt;this.ball.y+=this.ball.vy*dt;this.ball.vx*=Math.pow(.52,dt);this.ball.vy*=Math.pow(.52,dt);
    if(this.ball.y<f.top){this.ball.y=f.top;this.ball.vy=Math.abs(this.ball.vy)*.72}if(this.ball.y>f.bottom){this.ball.y=f.bottom;this.ball.vy=-Math.abs(this.ball.vy)*.72}
    const inGoal=this.ball.y>=f.goalTop&&this.ball.y<=f.goalBottom;if(this.ball.x>=f.right){if(inGoal){this.goal('blue');return}else{this.ball.x=f.right;this.ball.vx=-Math.abs(this.ball.vx)*.65}}if(this.ball.x<=f.left){if(inGoal){this.goal('red');return}else{this.ball.x=f.left;this.ball.vx=Math.abs(this.ball.vx)*.65}}
    const b=this.nearest('blue',this.ball),r=this.nearest('red',this.ball),c=b.d<=r.d?b:r;if(c.p&&c.d<19&&Math.hypot(this.ball.vx,this.ball.vy)<155){this.ball.owner=c.p;this.ball.vx=this.ball.vy=0}}
  goal(team){this.score[team]++;this.renderScore();this.game.dataset.lastGoal=team;setTimeout(()=>this.resetBall(),650);this.ball.x=-999;this.ball.y=-999;this.ball.vx=this.ball.vy=0;this.ball.owner=null}
  renderScore(){const el=document.querySelector('.scorebox b');if(el)el.innerHTML=`${this.score.blue} &nbsp;×&nbsp; ${this.score.red}`}
  paint(){const f=this.field();for(const p of this.players){p.x=Math.max(f.left,Math.min(f.right,p.x));p.y=Math.max(f.top,Math.min(f.bottom,p.y));p.el.style.left=p.x+'px';p.el.style.top=p.y+'px'}this.ballEl.style.left=this.ball.x+'px';this.ballEl.style.top=this.ball.y+'px'}
  step(dt){const f=this.field();if(this.ball.owner)this.updateOwned(dt,f);else this.updateFree(dt,f);this.physics(dt,f);this.paint()}
  loop(t){if(!this.started)return;const dt=Math.min(.034,Math.max(.001,(t-this.last)/1000));this.last=t;if(!this.game.classList.contains('is-paused'))this.step(dt);this.raf=requestAnimationFrame(n=>this.loop(n))}
  stop(){this.started=false;cancelAnimationFrame(this.raf)}
}
function boot(){const attempt=()=>{const e=new FutLiveFootballEngine();if(!e.start())setTimeout(attempt,120)};attempt()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.FutLiveFootballEngineClass=FutLiveFootballEngine;
})();