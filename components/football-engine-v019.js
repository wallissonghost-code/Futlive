(()=>{'use strict';
const VERSION='0.19';
class FutLiveFootballEngine{
  constructor({game='#game',ball='.ball'}={}){
    this.game=typeof game==='string'?document.querySelector(game):game;
    this.ballEl=typeof ball==='string'?document.querySelector(ball):ball;
    this.controllers=[];this.players=[];
    this.ball={x:0,y:0,vx:0,vy:0,owner:null,type:'free',curve:0,intended:null,lastTouch:null,pickupLock:0};
    this.score={blue:1,red:0};this.last=0;this.raf=0;this.started=false;
    this.actionLock=0;this.ownerSince=0;this.lastAction='';
    this.formation={blue:[[.23,.40],[.34,.58],[.42,.29]],red:[[.77,.58],[.66,.36],[.58,.67]]};
  }
  start(){if(this.started||!this.game||!this.ballEl)return false;const bag=window.FutLivePlayers;if(!bag?.team1?.length||!bag?.team2?.length)return false;
    this.controllers=[...bag.team1,...bag.team2];const rect=this.game.getBoundingClientRect();
    this.players=this.controllers.map((ctrl,i)=>{const team=i<3?'blue':'red',slot=i%3,pos=this.formation[team][slot],el=ctrl.el;el.style.right='auto';return{ctrl,el,team,slot,x:rect.width*pos[0],y:rect.height*pos[1],speed:team==='blue'?88:86,lastDir:'idle',role:'shape'}});
    this.resetBall();this.renderScore();this.started=true;this.last=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t));window.FutLiveFootballEngine=this;return true}
  field(){const r=this.game.getBoundingClientRect(),hud=document.getElementById('liveGiftHud'),hudTop=hud?hud.getBoundingClientRect().top-r.top:r.height*.78;return{w:r.width,h:r.height,left:r.width*.04,right:r.width*.96,top:r.height*.10,bottom:Math.max(r.height*.60,hudTop-18),goalTop:r.height*.36,goalBottom:r.height*.64,goalDepth:26}}
  resetBall(){const f=this.field();this.ball.x=(f.left+f.right)/2;this.ball.y=(f.top+f.bottom)/2;this.ball.vx=this.ball.vy=0;this.ball.owner=null;this.ball.type='free';this.ball.curve=0;this.ball.intended=null;this.ball.lastTouch=null;this.ball.pickupLock=0;this.ownerSince=0;this.players.forEach(p=>{const q=this.formation[p.team][p.slot];p.x=f.w*q[0];p.y=f.h*q[1];p.role='shape';p.ctrl.idle()});this.paint()}
  dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  dirFor(dx,dy){if(Math.abs(dx)>Math.abs(dy))return dx>0?'right':'left';return dy>0?'down':'up'}
  animate(p,dx,dy){const d=this.dirFor(dx,dy);if(p.lastDir!==d){p.lastDir=d;p.ctrl.move(d)}}
  moveToward(p,tx,ty,speed,dt){const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);if(d<1){if(p.lastDir!=='idle'){p.lastDir='idle';p.ctrl.idle()}return d}const step=Math.min(d,speed*dt);p.x+=dx/d*step;p.y+=dy/d*step;this.animate(p,dx,dy);return d}
  nearest(team,target,exclude=null){let best=null,bd=Infinity;for(const p of this.players){if(p.team!==team||p===exclude)continue;const d=this.dist(p,target);if(d<bd){bd=d;best=p}}return{p:best,d:bd}}
  opponents(team){return this.players.filter(p=>p.team!==team)}
  mates(team,exclude=null){return this.players.filter(p=>p.team===team&&p!==exclude)}
  freeBallAI(dt,f){const b=this.nearest('blue',this.ball),r=this.nearest('red',this.ball);const chase=[b.p,r.p].filter(Boolean);for(const p of chase){p.role='chase';this.moveToward(p,this.ball.x,this.ball.y,p.speed*1.20,dt)}
    for(const p of this.players){if(chase.includes(p))continue;const home=this.formation[p.team][p.slot],attack=p.team==='blue'?1:-1,predictX=this.ball.x+this.ball.vx*.22,predictY=this.ball.y+this.ball.vy*.18;const tx=f.w*home[0]+(predictX-f.w*.5)*.16+attack*(p.slot-1)*12,ty=f.h*home[1]+(predictY-f.h*.5)*.10;p.role='support';this.moveToward(p,tx,ty,p.speed*.68,dt)}
    const now=performance.now();if(now>=this.ball.pickupLock){const cand=b.d<=r.d?b:r;if(cand.p&&cand.d<22){this.takePossession(cand.p,'recovery')}}}
  takePossession(p,reason='control'){this.ball.owner=p;this.ball.vx=this.ball.vy=0;this.ball.curve=0;this.ball.type='owned';this.ball.intended=null;this.ball.lastTouch=p;this.ownerSince=performance.now();this.lastAction=reason;this.game.dataset.lastAction=reason}
  choosePassTarget(carrier,f){const attack=carrier.team==='blue'?1:-1,opps=this.opponents(carrier.team);let best=null,bestScore=-1e9;for(const m of this.mates(carrier.team,carrier)){const forward=(m.x-carrier.x)*attack;const open=Math.min(...opps.map(o=>this.dist(m,o)));const lane=Math.abs(m.y-carrier.y);const score=forward*.85+open*.9-lane*.15+Math.random()*18;if(score>bestScore){bestScore=score;best=m}}return best}
  pass(carrier,target,f){if(!target)return false;const dx=target.x-carrier.x,dy=target.y-carrier.y,d=Math.hypot(dx,dy)||1;const speed=Math.min(285,190+d*.35);this.ball.owner=null;this.ball.type='pass';this.ball.curve=0;this.ball.intended=target;this.ball.lastTouch=carrier;this.ball.pickupLock=performance.now()+170;this.ball.x=carrier.x+(carrier.team==='blue'?11:-11);this.ball.y=carrier.y;this.ball.vx=dx/d*speed;this.ball.vy=dy/d*speed;this.actionLock=performance.now()+480;this.lastAction='pass';this.game.dataset.lastAction='pass';return true}
  shoot(carrier,f){const attack=carrier.team==='blue'?1:-1,goalX=carrier.team==='blue'?f.right+f.goalDepth:f.left-f.goalDepth;const roll=Math.random();let kind,power,spread;if(roll<.28){kind='weak';power=225;spread=.42}else if(roll<.72){kind='medium';power=315;spread=.58}else{kind='strong';power=405;spread=.78}const curved=Math.random()<.42;const targetY=(f.goalTop+f.goalBottom)/2+(Math.random()-.5)*(f.goalBottom-f.goalTop)*spread;const dx=goalX-carrier.x,dy=targetY-carrier.y,d=Math.hypot(dx,dy)||1;this.ball.owner=null;this.ball.type='shot-'+kind+(curved?'-curve':'-straight');this.ball.curve=curved?(Math.random()<.5?-1:1)*(.52+Math.random()*.30):0;this.ball.intended=null;this.ball.lastTouch=carrier;this.ball.pickupLock=performance.now()+240;this.ball.x=carrier.x+attack*15;this.ball.y=carrier.y;this.ball.vx=dx/d*power;this.ball.vy=dy/d*power;this.actionLock=performance.now()+700;carrier.ctrl.kick();carrier.lastDir='kick';this.lastAction=this.ball.type;this.game.dataset.lastAction=this.ball.type;return true}
  ownedAI(dt,f){const c=this.ball.owner;if(!c)return;const attack=c.team==='blue'?1:-1,goalX=c.team==='blue'?f.right:f.left,goalY=(f.goalTop+f.goalBottom)/2,enemyTeam=c.team==='blue'?'red':'blue';
    const press=this.nearest(enemyTeam,c).p;if(press){press.role='press';this.moveToward(press,c.x,c.y,press.speed*1.12,dt)}
    const mates=this.mates(c.team,c),defs=this.opponents(c.team).filter(p=>p!==press);
    mates.forEach((m,i)=>{m.role='run';const lane=i===0?f.top+(f.bottom-f.top)*.30:f.top+(f.bottom-f.top)*.70;const tx=Math.max(f.left+35,Math.min(f.right-35,c.x+attack*(70+i*26)));this.moveToward(m,tx,lane,m.speed*.86,dt)});
    defs.forEach((d,i)=>{const mark=mates[i%mates.length]||c;d.role='mark';const cutX=(c.x+mark.x)*.5-attack*12,cutY=(c.y+mark.y)*.5;this.moveToward(d,cutX,cutY,d.speed*.80,dt)});
    const carrierTargetX=goalX-attack*80;this.moveToward(c,carrierTargetX,goalY,c.speed*1.02,dt);this.ball.x=c.x+attack*14;this.ball.y=c.y+5;
    const now=performance.now(),pressure=press?this.dist(press,c):999,possessMs=now-this.ownerSince,goalDist=Math.abs(goalX-c.x),passTarget=this.choosePassTarget(c,f);
    if(press&&pressure<18&&now>this.actionLock&&Math.random()<dt*2.4){this.takePossession(press,'steal');this.actionLock=now+420;this.game.dataset.lastAction='steal';return}
    const passNeed=(pressure<48&&possessMs>420)||(possessMs>1450&&Math.random()<dt*.95);
    if(passNeed&&passTarget&&now>this.actionLock){this.pass(c,passTarget,f);return}
    const shootRange=f.w*.48;const shootChance=goalDist<shootRange&&(possessMs>520)&&(goalDist<f.w*.28||Math.random()<dt*.72);if(shootChance&&now>this.actionLock){this.shoot(c,f)}}
  interceptAndReceive(dt,f){if(this.ball.owner)return;const now=performance.now();if(now<this.ball.pickupLock)return;const speed=Math.hypot(this.ball.vx,this.ball.vy);let best=null,bd=Infinity;for(const p of this.players){if(p===this.ball.lastTouch&&speed>120)continue;const d=this.dist(p,this.ball);if(d<bd){bd=d;best=p}}
    if(!best)return;const intended=this.ball.intended;if(this.ball.type==='pass'&&best===intended&&bd<21){this.takePossession(best,'pass-received');return}
    if(this.ball.type==='pass'&&best.team!==this.ball.lastTouch?.team&&bd<20){const chance=Math.min(.95,dt*(7.5+Math.max(0,210-speed)/45));if(Math.random()<chance){this.takePossession(best,'interception');this.game.dataset.lastAction='interception';return}}
    if(this.ball.type.startsWith('shot')&&best.team!==this.ball.lastTouch?.team&&bd<17&&speed<310&&Math.random()<dt*2.2){this.takePossession(best,'shot-block');return}
    if(speed<135&&bd<19)this.takePossession(best,'recovery')}
  physics(dt,f){if(this.ball.owner)return;const speed=Math.hypot(this.ball.vx,this.ball.vy);if(this.ball.curve&&speed>30){const ang=this.ball.curve*dt,nx=this.ball.vx*Math.cos(ang)-this.ball.vy*Math.sin(ang),ny=this.ball.vx*Math.sin(ang)+this.ball.vy*Math.cos(ang);this.ball.vx=nx;this.ball.vy=ny}
    this.ball.x+=this.ball.vx*dt;this.ball.y+=this.ball.vy*dt;const drag=this.ball.type.startsWith('shot')?.74:.58;this.ball.vx*=Math.pow(drag,dt);this.ball.vy*=Math.pow(drag,dt);
    if(this.ball.y<f.top){this.ball.y=f.top;this.ball.vy=Math.abs(this.ball.vy)*.70;this.ball.curve*=-.5}if(this.ball.y>f.bottom){this.ball.y=f.bottom;this.ball.vy=-Math.abs(this.ball.vy)*.70;this.ball.curve*=-.5}
    const inGoal=this.ball.y>=f.goalTop&&this.ball.y<=f.goalBottom;if(this.ball.x>f.right){if(inGoal){if(this.ball.x>=f.right+f.goalDepth){this.goal('blue');return}}else{this.ball.x=f.right;this.ball.vx=-Math.abs(this.ball.vx)*.62;this.ball.curve*=-.4}}if(this.ball.x<f.left){if(inGoal){if(this.ball.x<=f.left-f.goalDepth){this.goal('red');return}}else{this.ball.x=f.left;this.ball.vx=Math.abs(this.ball.vx)*.62;this.ball.curve*=-.4}}
    this.interceptAndReceive(dt,f)}
  goal(team){this.score[team]++;this.renderScore();this.game.dataset.lastGoal=team;this.game.dataset.lastAction='goal';this.ball.x=-999;this.ball.y=-999;this.ball.vx=this.ball.vy=0;this.ball.owner=null;setTimeout(()=>this.resetBall(),650)}
  renderScore(){const el=document.querySelector('.scorebox b');if(el)el.innerHTML=`${this.score.blue} &nbsp;×&nbsp; ${this.score.red}`}
  paint(){const f=this.field();for(const p of this.players){p.x=Math.max(f.left,Math.min(f.right,p.x));p.y=Math.max(f.top,Math.min(f.bottom,p.y));p.el.style.left=p.x+'px';p.el.style.top=p.y+'px'}this.ballEl.style.left=this.ball.x+'px';this.ballEl.style.top=this.ball.y+'px';this.ballEl.dataset.type=this.ball.type}
  step(dt){const f=this.field();if(this.ball.owner)this.ownedAI(dt,f);else this.freeBallAI(dt,f);this.physics(dt,f);this.paint()}
  loop(t){if(!this.started)return;const dt=Math.min(.034,Math.max(.001,(t-this.last)/1000));this.last=t;if(!this.game.classList.contains('is-paused'))this.step(dt);this.raf=requestAnimationFrame(n=>this.loop(n))}
  stop(){this.started=false;cancelAnimationFrame(this.raf)}
}
function boot(){const attempt=()=>{const e=new FutLiveFootballEngine();if(!e.start())setTimeout(attempt,120)};attempt()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.FutLiveFootballEngineClass=FutLiveFootballEngine;
})();