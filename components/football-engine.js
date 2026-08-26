(()=>{'use strict';
const VERSION='0.20';
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
  clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  rand(a,b){return a+Math.random()*(b-a)}
  start(){if(this.started||!this.game||!this.ballEl)return false;const bag=window.FutLivePlayers;if(!bag?.team1?.length||!bag?.team2?.length)return false;
    this.controllers=[...bag.team1,...bag.team2];const rect=this.game.getBoundingClientRect();
    this.players=this.controllers.map((ctrl,i)=>{const team=i<3?'blue':'red',slot=i%3,pos=this.formation[team][slot],el=ctrl.el;el.style.right='auto';
      const personality=['creator','runner','finisher'][slot];
      return{ctrl,el,team,slot,personality,x:rect.width*pos[0],y:rect.height*pos[1],baseSpeed:this.rand(78,92),speed:0,lastDir:'idle',role:'shape',nextThink:0,
        skill:{control:this.rand(.58,.90),pass:this.rand(.55,.89),shoot:this.rand(.55,.91),defend:this.rand(.48,.84),vision:this.rand(.52,.90),composure:this.rand(.46,.88),curve:this.rand(.35,.82)}}});
    this.players.forEach(p=>p.speed=p.baseSpeed*(p.personality==='runner'?1.07:1));
    this.resetBall();this.renderScore();this.started=true;this.last=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t));window.FutLiveFootballEngine=this;
    const v=document.querySelector('.version');if(v)v.textContent='BETA '+VERSION;
    return true}
  field(){const r=this.game.getBoundingClientRect(),hud=document.getElementById('liveGiftHud'),hudTop=hud?hud.getBoundingClientRect().top-r.top:r.height*.78;return{w:r.width,h:r.height,left:r.width*.04,right:r.width*.96,top:r.height*.10,bottom:Math.max(r.height*.60,hudTop-18),goalTop:r.height*.36,goalBottom:r.height*.64,goalDepth:26}}
  resetBall(){const f=this.field();this.ball.x=(f.left+f.right)/2;this.ball.y=(f.top+f.bottom)/2;this.ball.vx=this.ball.vy=0;this.ball.owner=null;this.ball.type='free';this.ball.curve=0;this.ball.intended=null;this.ball.lastTouch=null;this.ball.pickupLock=0;this.ownerSince=0;this.players.forEach(p=>{const q=this.formation[p.team][p.slot];p.x=f.w*q[0];p.y=f.h*q[1];p.role='shape';p.nextThink=performance.now()+this.rand(80,280);p.ctrl.idle()});this.paint()}
  dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  dirFor(dx,dy){if(Math.abs(dx)>Math.abs(dy))return dx>0?'right':'left';return dy>0?'down':'up'}
  animate(p,dx,dy){const d=this.dirFor(dx,dy);if(p.lastDir!==d){p.lastDir=d;p.ctrl.move(d)}}
  moveToward(p,tx,ty,speed,dt){const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);if(d<1){if(p.lastDir!=='idle'){p.lastDir='idle';p.ctrl.idle()}return d}const step=Math.min(d,speed*dt);p.x+=dx/d*step;p.y+=dy/d*step;this.animate(p,dx,dy);return d}
  nearest(team,target,exclude=null){let best=null,bd=Infinity;for(const p of this.players){if(p.team!==team||p===exclude)continue;const d=this.dist(p,target);if(d<bd){bd=d;best=p}}return{p:best,d:bd}}
  opponents(team){return this.players.filter(p=>p.team!==team)}
  mates(team,exclude=null){return this.players.filter(p=>p.team===team&&p!==exclude)}
  freeBallAI(dt,f){const b=this.nearest('blue',this.ball),r=this.nearest('red',this.ball),now=performance.now();
    for(const n of [b,r])if(n.p){const p=n.p,hesitate=now<p.nextThink?.75:1;if(hesitate===1){p.role='chase';this.moveToward(p,this.ball.x+this.ball.vx*.12,this.ball.y+this.ball.vy*.10,p.speed*1.12,dt)}}
    const chase=[b.p,r.p].filter(Boolean);for(const p of this.players){if(chase.includes(p))continue;const home=this.formation[p.team][p.slot],attack=p.team==='blue'?1:-1,predictX=this.ball.x+this.ball.vx*.16,predictY=this.ball.y+this.ball.vy*.13;
      const wander=Math.sin((performance.now()/700)+(p.slot*2)+(p.team==='red'?1:0))*18;const tx=f.w*home[0]+(predictX-f.w*.5)*.13+attack*(p.slot-1)*10,ty=f.h*home[1]+(predictY-f.h*.5)*.08+wander;p.role='support';this.moveToward(p,tx,ty,p.speed*.60,dt)}
    if(now>=this.ball.pickupLock){const candidates=[b,r].filter(n=>n.p&&n.d<23).sort((a,z)=>a.d-z.d);for(const n of candidates){const controlChance=n.p.skill.control*(n.d<15?.94:.72);if(Math.random()<controlChance){this.takePossession(n.p,'recovery');break}}}}
  takePossession(p,reason='control'){this.ball.owner=p;this.ball.vx=this.ball.vy=0;this.ball.curve=0;this.ball.type='owned';this.ball.intended=null;this.ball.lastTouch=p;this.ownerSince=performance.now();p.nextThink=this.ownerSince+this.rand(260,760);this.lastAction=reason;this.game.dataset.lastAction=reason}
  choosePassTarget(carrier){const attack=carrier.team==='blue'?1:-1,opps=this.opponents(carrier.team);let best=null,bestScore=-1e9;for(const m of this.mates(carrier.team,carrier)){const forward=(m.x-carrier.x)*attack,open=Math.min(...opps.map(o=>this.dist(m,o))),lane=Math.abs(m.y-carrier.y);let score=forward*(.45+carrier.skill.vision*.55)+open*(.42+carrier.skill.vision*.45)-lane*.10+this.rand(-34,34);if(m.personality==='runner')score+=18;if(score>bestScore){bestScore=score;best=m}}return best}
  pass(carrier,target){if(!target)return false;const lead=(target.personality==='runner'?this.rand(18,42):this.rand(4,20))*(carrier.team==='blue'?1:-1);const accuracy=(carrier.skill.pass-.5)*42;const missX=this.rand(-26,26)*(1-carrier.skill.pass),missY=this.rand(-48,48)*(1-carrier.skill.pass);const tx=target.x+lead+missX,ty=target.y+missY,dx=tx-carrier.x,dy=ty-carrier.y,d=Math.hypot(dx,dy)||1;const speed=Math.min(292,180+d*.34+accuracy);
    this.ball.owner=null;this.ball.type='pass';this.ball.curve=0;this.ball.intended=target;this.ball.lastTouch=carrier;this.ball.pickupLock=performance.now()+190;this.ball.x=carrier.x+(carrier.team==='blue'?11:-11);this.ball.y=carrier.y;this.ball.vx=dx/d*speed;this.ball.vy=dy/d*speed;this.actionLock=performance.now()+this.rand(420,620);this.lastAction='pass';this.game.dataset.lastAction='pass';return true}
  shoot(carrier,f){const attack=carrier.team==='blue'?1:-1,goalX=carrier.team==='blue'?f.right+f.goalDepth:f.left-f.goalDepth;const roll=Math.random();let kind,power,baseSpread;if(roll<.30){kind='weak';power=this.rand(205,250);baseSpread=.50}else if(roll<.76){kind='medium';power=this.rand(275,340);baseSpread=.70}else{kind='strong';power=this.rand(355,430);baseSpread=.92}
    const skill=carrier.skill.shoot,pressure=this.nearest(carrier.team==='blue'?'red':'blue',carrier).d,panic=pressure<32?(32-pressure)/32:0;const spread=baseSpread*(1.35-skill*.65+panic*.55);const aimError=(Math.random()-.5)*(f.goalBottom-f.goalTop)*spread;const targetY=(f.goalTop+f.goalBottom)/2+aimError;
    const curved=Math.random()<(.18+carrier.skill.curve*.38),dx=goalX-carrier.x,dy=targetY-carrier.y,d=Math.hypot(dx,dy)||1;this.ball.owner=null;this.ball.type='shot-'+kind+(curved?'-curve':'-straight');this.ball.curve=curved?(Math.random()<.5?-1:1)*this.rand(.34,.72)*carrier.skill.curve:0;this.ball.intended=null;this.ball.lastTouch=carrier;this.ball.pickupLock=performance.now()+250;this.ball.x=carrier.x+attack*15;this.ball.y=carrier.y;this.ball.vx=dx/d*power;this.ball.vy=dy/d*power;this.actionLock=performance.now()+this.rand(620,840);carrier.ctrl.kick();carrier.lastDir='kick';this.lastAction=this.ball.type;this.game.dataset.lastAction=this.ball.type;return true}
  ownedAI(dt,f){const c=this.ball.owner;if(!c)return;const attack=c.team==='blue'?1:-1,goalX=c.team==='blue'?f.right:f.left,goalY=(f.goalTop+f.goalBottom)/2,enemyTeam=c.team==='blue'?'red':'blue',now=performance.now();
    const nearestEnemy=this.nearest(enemyTeam,c),press=nearestEnemy.p;if(press){press.role='press';const pressError=this.rand(-12,12)*(1-press.skill.defend);this.moveToward(press,c.x-attack*(8+pressError),c.y+pressError,press.speed*(.90+press.skill.defend*.20),dt)}
    const mates=this.mates(c.team,c),defs=this.opponents(c.team).filter(p=>p!==press);mates.forEach((m,i)=>{m.role='run';const lane=i===0?f.top+(f.bottom-f.top)*.27:f.top+(f.bottom-f.top)*.73;const surge=(m.personality==='runner'?105:72)+i*20;const tx=this.clamp(c.x+attack*surge,f.left+28,f.right-28);this.moveToward(m,tx,lane,m.speed*(m.personality==='runner'?.92:.76),dt)});
    defs.forEach((d,i)=>{const mark=mates[i%mates.length]||c;d.role='mark';const awareness=d.skill.defend;const slack=(1-awareness)*this.rand(18,55);const cutX=(c.x+mark.x)*.5-attack*(8+slack),cutY=(c.y+mark.y)*.5+this.rand(-22,22)*(1-awareness);this.moveToward(d,cutX,cutY,d.speed*(.60+awareness*.18),dt)});
    const dribbleY=goalY+Math.sin(now/520+c.slot*1.7)*this.rand(18,42)*(1-c.skill.composure*.35),carrierTargetX=goalX-attack*this.rand(58,105);this.moveToward(c,carrierTargetX,dribbleY,c.speed*(.91+c.skill.control*.12),dt);this.ball.x=c.x+attack*14;this.ball.y=c.y+5;
    const pressure=press?this.dist(press,c):999,possessMs=now-this.ownerSince,goalDist=Math.abs(goalX-c.x),passTarget=this.choosePassTarget(c);
    if(press&&pressure<18&&now>this.actionLock){const tackleBase=.20+press.skill.defend*.38,protect=.18+c.skill.control*.32;if(Math.random()<dt*2.1*Math.max(.12,tackleBase-protect+.30)){this.takePossession(press,'steal');this.actionLock=now+this.rand(420,720);this.game.dataset.lastAction='steal';return}else if(Math.random()<dt*.65){this.ball.owner=null;this.ball.type='loose';this.ball.lastTouch=c;this.ball.pickupLock=now+180;this.ball.vx=attack*this.rand(55,110);this.ball.vy=this.rand(-85,85);return}}
    if(now<c.nextThink)return;
    const creativity=c.personality==='creator'?.22:0,passNeed=(pressure<this.rand(35,60)&&possessMs>this.rand(380,850))||(possessMs>this.rand(1250,2300)&&Math.random()<.55+creativity);
    if(passNeed&&passTarget&&now>this.actionLock&&Math.random()<.55+c.skill.pass*.35){this.pass(c,passTarget);return}
    const shootRange=f.w*(c.personality==='finisher'?.54:.46),close=goalDist<f.w*.25;const shotDecision=goalDist<shootRange&&possessMs>this.rand(420,900)&&(close||Math.random()<(.22+c.skill.shoot*.42));if(shotDecision&&now>this.actionLock){this.shoot(c,f);return}
    c.nextThink=now+this.rand(260,780)}
  interceptAndReceive(dt){if(this.ball.owner)return;const now=performance.now();if(now<this.ball.pickupLock)return;const speed=Math.hypot(this.ball.vx,this.ball.vy);let best=null,bd=Infinity;for(const p of this.players){if(p===this.ball.lastTouch&&speed>120)continue;const d=this.dist(p,this.ball);if(d<bd){bd=d;best=p}}if(!best)return;
    const intended=this.ball.intended;if(this.ball.type==='pass'&&best===intended&&bd<22){const receive=.42+best.skill.control*.50-Math.min(.20,speed/1400);if(Math.random()<receive){this.takePossession(best,'pass-received');return}else if(Math.random()<dt*1.3){this.ball.vx*=.58;this.ball.vy*=.58;this.ball.type='loose'}}
    if(this.ball.type==='pass'&&best.team!==this.ball.lastTouch?.team&&bd<19){const chance=dt*(1.2+best.skill.defend*2.3+best.skill.vision*.7);if(Math.random()<chance){this.takePossession(best,'interception');this.game.dataset.lastAction='interception';return}}
    if(this.ball.type.startsWith('shot')&&best.team!==this.ball.lastTouch?.team&&bd<16&&speed<295){if(Math.random()<dt*(.55+best.skill.defend*1.15)){this.ball.vx*=this.rand(-.35,.35);this.ball.vy+=this.rand(-120,120);this.ball.type='deflection';this.game.dataset.lastAction='shot-block';return}}
    if(speed<125&&bd<19&&Math.random()<.32+best.skill.control*.55)this.takePossession(best,'recovery')}
  physics(dt,f){if(this.ball.owner)return;const speed=Math.hypot(this.ball.vx,this.ball.vy);if(this.ball.curve&&speed>30){const ang=this.ball.curve*dt,nx=this.ball.vx*Math.cos(ang)-this.ball.vy*Math.sin(ang),ny=this.ball.vx*Math.sin(ang)+this.ball.vy*Math.cos(ang);this.ball.vx=nx;this.ball.vy=ny}
    this.ball.x+=this.ball.vx*dt;this.ball.y+=this.ball.vy*dt;const drag=this.ball.type.startsWith('shot')?.76:.60;this.ball.vx*=Math.pow(drag,dt);this.ball.vy*=Math.pow(drag,dt);
    if(this.ball.y<f.top){this.ball.y=f.top;this.ball.vy=Math.abs(this.ball.vy)*.70;this.ball.curve*=-.5}if(this.ball.y>f.bottom){this.ball.y=f.bottom;this.ball.vy=-Math.abs(this.ball.vy)*.70;this.ball.curve*=-.5}
    const inGoal=this.ball.y>=f.goalTop&&this.ball.y<=f.goalBottom;if(this.ball.x>f.right){if(inGoal){if(this.ball.x>=f.right+f.goalDepth){this.goal('blue');return}}else{this.ball.x=f.right;this.ball.vx=-Math.abs(this.ball.vx)*.62;this.ball.curve*=-.4}}if(this.ball.x<f.left){if(inGoal){if(this.ball.x<=f.left-f.goalDepth){this.goal('red');return}}else{this.ball.x=f.left;this.ball.vx=Math.abs(this.ball.vx)*.62;this.ball.curve*=-.4}}
    this.interceptAndReceive(dt)}
  goal(team){this.score[team]++;this.renderScore();this.game.dataset.lastGoal=team;this.game.dataset.lastAction='goal';this.ball.x=-999;this.ball.y=-999;this.ball.vx=this.ball.vy=0;this.ball.owner=null;setTimeout(()=>this.resetBall(),650)}
  renderScore(){const el=document.querySelector('.scorebox b');if(el)el.innerHTML=`${this.score.blue} &nbsp;×&nbsp; ${this.score.red}`}
  paint(){const f=this.field();for(const p of this.players){p.x=this.clamp(p.x,f.left,f.right);p.y=this.clamp(p.y,f.top,f.bottom);p.el.style.left=p.x+'px';p.el.style.top=p.y+'px'}this.ballEl.style.left=this.ball.x+'px';this.ballEl.style.top=this.ball.y+'px';this.ballEl.dataset.type=this.ball.type}
  step(dt){const f=this.field();if(this.ball.owner)this.ownedAI(dt,f);else this.freeBallAI(dt,f);this.physics(dt,f);this.paint()}
  loop(t){if(!this.started)return;const dt=Math.min(.034,Math.max(.001,(t-this.last)/1000));this.last=t;if(!this.game.classList.contains('is-paused'))this.step(dt);this.raf=requestAnimationFrame(n=>this.loop(n))}
  stop(){this.started=false;cancelAnimationFrame(this.raf)}
}
function boot(){const attempt=()=>{const e=new FutLiveFootballEngine();if(!e.start())setTimeout(attempt,120)};attempt()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.FutLiveFootballEngineClass=FutLiveFootballEngine;
})();